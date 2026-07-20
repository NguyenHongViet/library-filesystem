require "rails_helper"

RSpec.describe "Api::V1::Shared", type: :request do
  let(:password) { "password123" }
  let(:user) { create(:user, password: password) }

  def sign_in_user(account = user)
    post "/api/v1/login", params: { user: { email: account.email, password: password } }
  end

  describe "GET /api/v1/shared/users" do
    it "returns 401 when not signed in" do
      get "/api/v1/shared/users"
      expect(response).to have_http_status(:unauthorized)
    end

    it "lists every other user, whether or not they have shared anything" do
      sign_in_user
      sharer = create(:user, name: "Sharer")
      create(:document, user: sharer, is_public: true)
      create(:user, name: "No Public") # has shared nothing

      get "/api/v1/shared/users"

      names = JSON.parse(response.body)["users"].map { |u| u["name"] }
      expect(names).to contain_exactly("No Public", "Sharer")
    end

    it "excludes the current user" do
      sign_in_user
      create(:user, name: "Someone Else")

      get "/api/v1/shared/users"

      ids = JSON.parse(response.body)["users"].map { |u| u["id"] }
      expect(ids).not_to include(user.id)
    end
  end

  describe "GET /api/v1/shared/users/:user_id/entries" do
    let(:owner) { create(:user, name: "Owner") }

    it "returns 401 when not signed in" do
      get "/api/v1/shared/users/#{owner.id}/entries"
      expect(response).to have_http_status(:unauthorized)
    end

    it "lists the owner's public folders and files at the root" do
      sign_in_user
      create(:folder, user: owner, name: "Public folder", is_public: true)
      create(:folder, user: owner, name: "Private folder", is_public: false)
      create(:document, user: owner, name: "public.txt", is_public: true)
      create(:document, user: owner, name: "private.txt", is_public: false)

      get "/api/v1/shared/users/#{owner.id}/entries"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig("owner", "name")).to eq("Owner")
      expect(body["folders"].map { |f| f["name"] }).to eq([ "Public folder" ])
      expect(body["documents"].map { |d| d["name"] }).to eq([ "public.txt" ])
    end

    it "lists public entries inside a public folder" do
      sign_in_user
      parent = create(:folder, user: owner, name: "Parent", is_public: true)
      create(:folder, user: owner, name: "Child", parent: parent, is_public: true)
      create(:document, user: owner, name: "nested.txt", folder: parent, is_public: true)
      create(:document, user: owner, name: "hidden.txt", folder: parent, is_public: false)

      get "/api/v1/shared/users/#{owner.id}/entries", params: { parent_id: parent.id }

      body = JSON.parse(response.body)
      expect(body["folders"].map { |f| f["name"] }).to eq([ "Child" ])
      expect(body["documents"].map { |d| d["name"] }).to eq([ "nested.txt" ])
    end

    it "does not allow browsing into a private folder" do
      sign_in_user
      private_folder = create(:folder, user: owner, is_public: false)

      get "/api/v1/shared/users/#{owner.id}/entries", params: { parent_id: private_folder.id }

      expect(response).to have_http_status(:not_found)
    end

    it "excludes trashed public documents" do
      sign_in_user
      document = create(:document, user: owner, name: "gone.txt", is_public: true)
      document.soft_delete!

      get "/api/v1/shared/users/#{owner.id}/entries"

      expect(JSON.parse(response.body)["documents"]).to be_empty
    end

    it "returns 404 for an unknown user" do
      sign_in_user
      get "/api/v1/shared/users/0/entries"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/shared/documents/:id/download" do
    let(:owner) { create(:user) }

    def public_file(content, name: "shared.txt")
      document = build(:document, user: owner, name: name, is_public: true, content_type: "text/plain")
      document.file.attach(io: StringIO.new(content), filename: name, content_type: "text/plain")
      document.save!
      document
    end

    it "returns 401 when not signed in" do
      document = public_file("data")
      get "/api/v1/shared/documents/#{document.id}/download"
      expect(response).to have_http_status(:unauthorized)
    end

    it "streams another user's public file as an attachment" do
      sign_in_user
      document = public_file("shared content", name: "shared.txt")

      get "/api/v1/shared/documents/#{document.id}/download"

      expect(response).to have_http_status(:ok)
      expect(response.body).to eq("shared content")
      expect(response.headers["Content-Disposition"]).to include("attachment")
      expect(response.headers["Content-Disposition"]).to include("shared.txt")
    end

    it "returns 404 for a private file" do
      sign_in_user
      document = build(:document, user: owner, is_public: false)
      document.file.attach(io: StringIO.new("secret"), filename: "p.txt", content_type: "text/plain")
      document.save!

      get "/api/v1/shared/documents/#{document.id}/download"

      expect(response).to have_http_status(:not_found)
    end

    it "returns 404 for a trashed public file" do
      sign_in_user
      document = public_file("gone")
      document.soft_delete!

      get "/api/v1/shared/documents/#{document.id}/download"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/shared/folders/:id/download" do
    let(:owner) { create(:user) }

    def add_public_file(name, content, folder:, public: true)
      document = build(:document, user: owner, name: name, folder: folder, is_public: public, content_type: "text/plain")
      document.file.attach(io: StringIO.new(content), filename: name, content_type: "text/plain")
      document.save!
      document
    end

    def zip_contents(body)
      files = {}
      Zip::File.open_buffer(StringIO.new(body)) do |zip|
        zip.each { |entry| files[entry.name] = entry.directory? ? nil : entry.get_input_stream.read }
      end
      files
    end

    it "returns 401 when not signed in" do
      folder = create(:folder, user: owner, is_public: true)
      get "/api/v1/shared/folders/#{folder.id}/download"
      expect(response).to have_http_status(:unauthorized)
    end

    it "zips a public folder with only its public contents, keeping structure" do
      sign_in_user
      reports = create(:folder, user: owner, name: "Reports", is_public: true)
      public_child = create(:folder, user: owner, name: "Public Q1", parent: reports, is_public: true)
      create(:folder, user: owner, name: "Secret", parent: reports, is_public: false)
      add_public_file("summary.txt", "public summary", folder: reports)
      add_public_file("draft.txt", "hidden draft", folder: reports, public: false)
      add_public_file("jan.txt", "january", folder: public_child)

      get "/api/v1/shared/folders/#{reports.id}/download"

      expect(response).to have_http_status(:ok)
      expect(response.headers["Content-Disposition"]).to include("Reports.zip")
      files = zip_contents(response.body)
      expect(files["Reports/summary.txt"]).to eq("public summary")
      expect(files["Reports/Public Q1/jan.txt"]).to eq("january")
      expect(files.keys).not_to include("Reports/draft.txt")
      expect(files.keys).not_to include("Reports/Secret/")
    end

    it "returns 404 for a private folder" do
      sign_in_user
      private_folder = create(:folder, user: owner, is_public: false)

      get "/api/v1/shared/folders/#{private_folder.id}/download"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/shared/documents/:id/copy" do
    let(:owner) { create(:user) }

    def public_file(content, name: "shared.txt")
      document = build(:document, user: owner, name: name, is_public: true, content_type: "text/plain")
      document.file.attach(io: StringIO.new(content), filename: name, content_type: "text/plain")
      document.save!
      document
    end

    it "returns 401 when not signed in" do
      document = public_file("data")
      post "/api/v1/shared/documents/#{document.id}/copy"
      expect(response).to have_http_status(:unauthorized)
    end

    it "copies a public file into the current user's library as a fresh file" do
      sign_in_user
      source = public_file("hello", name: "shared.txt")

      expect do
        post "/api/v1/shared/documents/#{source.id}/copy"
      end.to change(user.documents, :count).by(1)

      expect(response).to have_http_status(:created)
      copy = user.documents.find(JSON.parse(response.body).dig("document", "id"))
      expect(copy.name).to eq("shared.txt")
      expect(copy.folder_id).to be_nil
      expect(copy.copied_from).to eq(source)
      expect(copy.file.download).to eq("hello")
      expect(copy.document_versions).to be_empty
      expect(copy.is_public).to be(true) # collaborative default
      # Independent blob, so purging one never affects the other.
      expect(copy.file.blob_id).not_to eq(source.file.blob_id)
    end

    it "copies into a chosen destination folder the user owns" do
      sign_in_user
      destination = create(:folder, user: user, name: "Inbox")
      source = public_file("data")

      post "/api/v1/shared/documents/#{source.id}/copy", params: { folder_id: destination.id }

      copy = user.documents.find(JSON.parse(response.body).dig("document", "id"))
      expect(copy.folder).to eq(destination)
    end

    it "renames the copy when a file with the same name already exists" do
      sign_in_user
      existing = create(:document, user: user, name: "shared.txt")
      source = public_file("hello", name: "shared.txt")

      post "/api/v1/shared/documents/#{source.id}/copy"

      expect(response).to have_http_status(:created)
      copy = user.documents.find(JSON.parse(response.body).dig("document", "id"))
      expect(copy.name).to eq("shared (1).txt")
      # The existing file is left untouched (not overwritten, no new version).
      expect(existing.reload.name).to eq("shared.txt")
      expect(existing.document_versions).to be_empty
    end

    it "increments the suffix past earlier copies" do
      sign_in_user
      create(:document, user: user, name: "shared.txt")
      create(:document, user: user, name: "shared (1).txt")
      source = public_file("hello", name: "shared.txt")

      post "/api/v1/shared/documents/#{source.id}/copy"

      copy = user.documents.find(JSON.parse(response.body).dig("document", "id"))
      expect(copy.name).to eq("shared (2).txt")
    end

    it "returns 404 for a private file" do
      sign_in_user
      private_doc = build(:document, user: owner, is_public: false)
      private_doc.file.attach(io: StringIO.new("x"), filename: "p.txt", content_type: "text/plain")
      private_doc.save!

      post "/api/v1/shared/documents/#{private_doc.id}/copy"

      expect(response).to have_http_status(:not_found)
    end

    it "returns 404 when the destination folder is not owned by the user" do
      sign_in_user
      source = public_file("data")
      other_folder = create(:folder)

      post "/api/v1/shared/documents/#{source.id}/copy", params: { folder_id: other_folder.id }

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/shared/folders/:id/copy" do
    let(:owner) { create(:user) }

    def public_file(name, content, folder:)
      document = build(:document, user: owner, name: name, folder: folder, is_public: true, content_type: "text/plain")
      document.file.attach(io: StringIO.new(content), filename: name, content_type: "text/plain")
      document.save!
      document
    end

    it "copies a public folder subtree, keeping only public items" do
      sign_in_user
      reports = create(:folder, user: owner, name: "Reports", is_public: true)
      public_child = create(:folder, user: owner, name: "Q1", parent: reports, is_public: true)
      create(:folder, user: owner, name: "Secret", parent: reports, is_public: false)
      public_file("summary.txt", "public summary", folder: reports)
      public_file("draft.txt", "hidden", folder: reports).update!(is_public: false)
      public_file("jan.txt", "january", folder: public_child)

      expect do
        post "/api/v1/shared/folders/#{reports.id}/copy"
      end.to change(user.folders, :count).by(2) # Reports + Q1 (not Secret)

      expect(response).to have_http_status(:created)
      copied = user.folders.find_by!(name: "Reports", parent_id: nil)
      expect(copied.documents.map(&:name)).to contain_exactly("summary.txt")
      q1 = user.folders.find_by!(name: "Q1", parent: copied)
      expect(q1.documents.map(&:name)).to contain_exactly("jan.txt")
      expect(user.documents.find_by(name: "draft.txt")).to be_nil
    end

    it "copies into a chosen destination folder" do
      sign_in_user
      destination = create(:folder, user: user, name: "Inbox")
      source = create(:folder, user: owner, name: "Reports", is_public: true)

      post "/api/v1/shared/folders/#{source.id}/copy", params: { folder_id: destination.id }

      expect(response).to have_http_status(:created)
      expect(user.folders.find_by!(name: "Reports").parent).to eq(destination)
    end

    it "returns 404 for a private folder" do
      sign_in_user
      private_folder = create(:folder, user: owner, is_public: false)

      post "/api/v1/shared/folders/#{private_folder.id}/copy"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "admin include_private access" do
    let(:admin) { create(:user, :admin, password: password) }
    let(:owner) { create(:user, name: "Owner") }

    def attach_file(document, content)
      document.file.attach(io: StringIO.new(content), filename: "#{document.name}", content_type: "text/plain")
      document.save!
      document
    end

    it "reveals private folders and files for an admin in entries" do
      sign_in_user(admin)
      create(:folder, user: owner, name: "Public", is_public: true)
      create(:folder, user: owner, name: "Private", is_public: false)
      create(:document, user: owner, name: "public.txt", is_public: true)
      create(:document, user: owner, name: "private.txt", is_public: false)

      get "/api/v1/shared/users/#{owner.id}/entries", params: { include_private: true }

      body = JSON.parse(response.body)
      expect(body["folders"].map { |f| f["name"] }).to contain_exactly("Public", "Private")
      expect(body["documents"].map { |d| d["name"] }).to contain_exactly("public.txt", "private.txt")
    end

    it "ignores include_private for a non-admin" do
      sign_in_user(member = create(:user, password: password))
      create(:folder, user: owner, name: "Private", is_public: false)
      create(:folder, user: owner, name: "Public", is_public: true)

      get "/api/v1/shared/users/#{owner.id}/entries", params: { include_private: true }

      names = JSON.parse(response.body)["folders"].map { |f| f["name"] }
      expect(names).to eq([ "Public" ])
      expect(member).to be_persisted
    end

    it "lets an admin browse into a private folder" do
      sign_in_user(admin)
      private_parent = create(:folder, user: owner, name: "Private", is_public: false)
      create(:document, user: owner, name: "inside.txt", folder: private_parent, is_public: false)

      get "/api/v1/shared/users/#{owner.id}/entries", params: { parent_id: private_parent.id, include_private: true }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["documents"].map { |d| d["name"] }).to eq([ "inside.txt" ])
    end

    it "includes private matches in an admin search" do
      sign_in_user(admin)
      create(:document, user: owner, name: "report-private.txt", is_public: false)

      get "/api/v1/shared/users/#{owner.id}/search", params: { q: "report", include_private: true }

      expect(JSON.parse(response.body)["documents"].map { |d| d["name"] }).to eq([ "report-private.txt" ])
    end

    it "lets an admin download a private file" do
      sign_in_user(admin)
      document = attach_file(build(:document, user: owner, name: "secret.txt", is_public: false), "top secret")

      get "/api/v1/shared/documents/#{document.id}/download", params: { include_private: true }

      expect(response).to have_http_status(:ok)
      expect(response.body).to eq("top secret")
    end

    it "does not let a non-admin download a private file even with the flag" do
      sign_in_user(create(:user, password: password))
      document = attach_file(build(:document, user: owner, name: "secret.txt", is_public: false), "top secret")

      get "/api/v1/shared/documents/#{document.id}/download", params: { include_private: true }

      expect(response).to have_http_status(:not_found)
    end

    it "zips private folder contents for an admin" do
      sign_in_user(admin)
      folder = create(:folder, user: owner, name: "Private", is_public: false)
      attach_file(build(:document, user: owner, name: "secret.txt", folder: folder, is_public: false), "hidden")

      get "/api/v1/shared/folders/#{folder.id}/download", params: { include_private: true }

      expect(response).to have_http_status(:ok)
      names = []
      Zip::File.open_buffer(StringIO.new(response.body)) { |zip| zip.each { |e| names << e.name } }
      expect(names).to include("Private/secret.txt")
    end

    it "copies a private file for an admin" do
      sign_in_user(admin)
      source = attach_file(build(:document, user: owner, name: "secret.txt", is_public: false), "hidden")

      post "/api/v1/shared/documents/#{source.id}/copy", params: { include_private: true }

      expect(response).to have_http_status(:created)
      copy = admin.documents.find(JSON.parse(response.body).dig("document", "id"))
      expect(copy.file.download).to eq("hidden")
    end

    it "copies a private folder subtree for an admin" do
      sign_in_user(admin)
      folder = create(:folder, user: owner, name: "Private", is_public: false)
      attach_file(build(:document, user: owner, name: "secret.txt", folder: folder, is_public: false), "hidden")

      expect do
        post "/api/v1/shared/folders/#{folder.id}/copy", params: { include_private: true }
      end.to change(admin.folders, :count).by(1)

      copied = admin.folders.find_by!(name: "Private")
      expect(copied.documents.map(&:name)).to contain_exactly("secret.txt")
    end
  end
end
