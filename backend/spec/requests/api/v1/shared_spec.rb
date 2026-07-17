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
end
