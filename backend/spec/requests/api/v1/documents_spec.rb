require "rails_helper"

RSpec.describe "Api::V1::Documents", type: :request do
  let(:password) { "password123" }
  let(:user) { create(:user, password: password) }
  let(:upload) { fixture_file_upload("sample.txt", "text/plain") }

  def sign_in_user(account = user)
    post "/api/v1/login", params: { user: { email: account.email, password: password } }
  end

  def build_upload(content, name: "note.txt")
    Rack::Test::UploadedFile.new(StringIO.new(content), "text/plain", original_filename: name)
  end

  def upload_note(content, name: "note.txt", folder_id: nil)
    post "/api/v1/documents", params: { file: build_upload(content, name: name), name: name, folder_id: folder_id }
  end

  describe "GET /api/v1/documents" do
    it "returns 401 when not signed in" do
      get "/api/v1/documents"
      expect(response).to have_http_status(:unauthorized)
    end

    it "lists only the current user's root documents ordered by name" do
      sign_in_user
      folder = create(:folder, user: user)
      create(:document, user: user, name: "b.txt")
      create(:document, user: user, name: "a.txt")
      create(:document, user: user, name: "in-folder.txt", folder: folder)
      create(:document, name: "other-user.txt")

      get "/api/v1/documents"

      expect(response).to have_http_status(:ok)
      names = JSON.parse(response.body)["documents"].map { |d| d["name"] }
      expect(names).to eq([ "a.txt", "b.txt" ])
    end

    it "scopes documents to a folder when folder_id is given" do
      sign_in_user
      folder = create(:folder, user: user)
      create(:document, user: user, name: "root.txt")
      create(:document, user: user, name: "nested.txt", folder: folder)

      get "/api/v1/documents", params: { folder_id: folder.id }

      names = JSON.parse(response.body)["documents"].map { |d| d["name"] }
      expect(names).to eq([ "nested.txt" ])
    end

    it "returns 404 for a folder owned by someone else" do
      sign_in_user
      other_folder = create(:folder)

      get "/api/v1/documents", params: { folder_id: other_folder.id }

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/documents" do
    it "returns 401 when not signed in" do
      post "/api/v1/documents", params: { file: upload }
      expect(response).to have_http_status(:unauthorized)
    end

    it "uploads a file and attaches it to a new document" do
      sign_in_user

      expect do
        post "/api/v1/documents", params: { file: upload }
      end.to change(user.documents, :count).by(1)

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)["document"]
      expect(body["name"]).to eq("sample.txt")
      expect(body["content_type"]).to eq("text/plain")
      expect(body["byte_size"]).to eq(12)
      expect(body["folder_id"]).to be_nil

      document = user.documents.find(body["id"])
      expect(document.file).to be_attached
    end

    it "uses a provided name over the original filename" do
      sign_in_user
      post "/api/v1/documents", params: { file: upload, name: "renamed.txt" }
      expect(JSON.parse(response.body).dig("document", "name")).to eq("renamed.txt")
    end

    it "attaches the document to a folder the user owns" do
      sign_in_user
      folder = create(:folder, user: user)

      post "/api/v1/documents", params: { file: upload, folder_id: folder.id }

      expect(response).to have_http_status(:created)
      expect(JSON.parse(response.body).dig("document", "folder_id")).to eq(folder.id)
    end

    it "returns 404 when uploading to a folder the user does not own" do
      sign_in_user
      other_folder = create(:folder)

      post "/api/v1/documents", params: { file: upload, folder_id: other_folder.id }

      expect(response).to have_http_status(:not_found)
    end

    it "returns 422 when no file is provided" do
      sign_in_user
      post "/api/v1/documents", params: {}
      expect(response).to have_http_status(:unprocessable_content)
      expect(JSON.parse(response.body)["errors"]).to include("File is required.")
    end

    it "recreates the folder chain from relative_path when uploading a folder" do
      sign_in_user

      post "/api/v1/documents", params: {
        file: fixture_file_upload("sample.txt", "text/plain"),
        relative_path: "MyFolder/Sub"
      }

      expect(response).to have_http_status(:created)
      document = user.documents.find(JSON.parse(response.body).dig("document", "id"))
      expect(document.folder.path).to eq("MyFolder/Sub")
    end

    it "recreates the folder chain under the current folder" do
      sign_in_user
      base = create(:folder, user: user, name: "Base")

      post "/api/v1/documents", params: {
        file: fixture_file_upload("sample.txt", "text/plain"),
        folder_id: base.id,
        relative_path: "Nested"
      }

      expect(response).to have_http_status(:created)
      document = user.documents.find(JSON.parse(response.body).dig("document", "id"))
      expect(document.folder.path).to eq("Base/Nested")
    end
  end

  describe "POST /api/v1/documents (overwriting same name and location)" do
    it "overwrites the existing file and archives the previous contents" do
      sign_in_user
      upload_note("first")
      document_id = JSON.parse(response.body).dig("document", "id")

      expect { upload_note("second version") }.not_to change(user.documents, :count)

      expect(response).to have_http_status(:ok)
      document = user.documents.find(document_id)
      expect(document.file.download).to eq("second version")
      expect(document.document_versions.count).to eq(1)
      expect(document.document_versions.sole.file.download).to eq("first")
    end

    it "does not create a version when the same content is re-uploaded" do
      sign_in_user
      upload_note("identical")
      document_id = JSON.parse(response.body).dig("document", "id")

      expect { upload_note("identical") }.not_to change {
        user.documents.find(document_id).document_versions.count
      }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["unchanged"]).to be(true)
    end

    it "creates a version when the same-named file's content changes" do
      sign_in_user
      upload_note("before")
      document_id = JSON.parse(response.body).dig("document", "id")

      upload_note("after")

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["unchanged"]).to be(false)
      expect(user.documents.find(document_id).document_versions.count).to eq(1)
    end

    it "keeps at most the 5 most recent versions" do
      sign_in_user
      upload_note("v0")
      document_id = JSON.parse(response.body).dig("document", "id")
      7.times { |i| upload_note("v#{i + 1}") }

      document = user.documents.find(document_id)
      expect(document.file.download).to eq("v7")
      expect(document.document_versions.count).to eq(4)
      expect(document.document_versions.order(:version_number).pluck(:version_number)).to eq([ 4, 5, 6, 7 ])
    end

    it "treats the same name in a different folder as a separate file" do
      sign_in_user
      folder = create(:folder, user: user)
      upload_note("root copy")

      expect { upload_note("nested copy", folder_id: folder.id) }
        .to change(user.documents, :count).by(1)
      expect(response).to have_http_status(:created)
    end

    it "does not overwrite a trashed file of the same name" do
      sign_in_user
      upload_note("original")
      user.documents.sole.soft_delete!

      expect { upload_note("fresh") }.to change(user.documents.kept, :count).by(1)
      expect(response).to have_http_status(:created)
    end
  end

  describe "PATCH /api/v1/documents/:id" do
    it "returns 401 when not signed in" do
      document = create(:document)
      patch "/api/v1/documents/#{document.id}"
      expect(response).to have_http_status(:unauthorized)
    end

    it "moves a document into a folder the user owns" do
      sign_in_user
      document = create(:document, user: user)
      folder = create(:folder, user: user)

      patch "/api/v1/documents/#{document.id}", params: { folder_id: folder.id }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig("document", "folder_id")).to eq(folder.id)
      expect(document.reload.folder_id).to eq(folder.id)
    end

    it "moves a document back to the root when folder_id is blank" do
      sign_in_user
      folder = create(:folder, user: user)
      document = create(:document, user: user, folder: folder)

      patch "/api/v1/documents/#{document.id}", params: { folder_id: "" }

      expect(response).to have_http_status(:ok)
      expect(document.reload.folder_id).to be_nil
    end

    it "toggles the public flag without moving the document" do
      sign_in_user
      folder = create(:folder, user: user)
      document = create(:document, user: user, folder: folder, is_public: false)

      patch "/api/v1/documents/#{document.id}", params: { is_public: true }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig("document", "is_public")).to be(true)
      document.reload
      expect(document.is_public).to be(true)
      expect(document.folder_id).to eq(folder.id)
    end

    it "returns 404 for a document owned by someone else" do
      sign_in_user
      other_document = create(:document)

      patch "/api/v1/documents/#{other_document.id}"

      expect(response).to have_http_status(:not_found)
    end

    it "returns 404 when moving into a folder owned by someone else" do
      sign_in_user
      document = create(:document, user: user)
      other_folder = create(:folder)

      patch "/api/v1/documents/#{document.id}", params: { folder_id: other_folder.id }

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/documents/:id" do
    it "returns 401 when not signed in" do
      document = create(:document)
      delete "/api/v1/documents/#{document.id}"
      expect(response).to have_http_status(:unauthorized)
    end

    it "soft deletes the document and hides it from the listing" do
      sign_in_user
      document = create(:document, user: user)

      delete "/api/v1/documents/#{document.id}"

      expect(response).to have_http_status(:no_content)
      expect(document.reload).to be_trashed

      get "/api/v1/documents"
      expect(JSON.parse(response.body)["documents"]).to be_empty
    end

    it "returns 404 for a document owned by someone else" do
      sign_in_user
      other = create(:document)

      delete "/api/v1/documents/#{other.id}"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/documents/:id/restore" do
    it "restores a trashed document" do
      sign_in_user
      document = create(:document, user: user)
      document.soft_delete!

      post "/api/v1/documents/#{document.id}/restore"

      expect(response).to have_http_status(:ok)
      expect(document.reload).not_to be_trashed
    end

    it "rebuilds the folder path when the file's folder was deleted" do
      sign_in_user
      folder = create(:folder, user: user, name: "Reports")
      document = create(:document, user: user, folder: folder)
      delete "/api/v1/folders/#{folder.id}"

      post "/api/v1/documents/#{document.id}/restore"

      expect(response).to have_http_status(:ok)
      document.reload
      expect(document).not_to be_trashed
      expect(document.folder.path).to eq("Reports")
    end

    it "returns 404 when the document is not in the trash" do
      sign_in_user
      document = create(:document, user: user)

      post "/api/v1/documents/#{document.id}/restore"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/documents/:id" do
    it "returns 401 when not signed in" do
      document = create(:document)
      get "/api/v1/documents/#{document.id}"
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns the document and its versions, newest first" do
      sign_in_user
      upload_note("v0")
      document_id = JSON.parse(response.body).dig("document", "id")
      upload_note("v1")
      upload_note("v2")

      get "/api/v1/documents/#{document_id}"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig("document", "id")).to eq(document_id)
      expect(body["versions"].map { |v| v["version_number"] }).to eq([ 2, 1 ])
    end

    it "includes the folder path as the file location" do
      sign_in_user
      folder = create(:folder, user: user, name: "Reports")
      nested = create(:folder, user: user, parent: folder, name: "Q1")
      document = create(:document, user: user, folder: nested, name: "note.txt")

      get "/api/v1/documents/#{document.id}"

      expect(JSON.parse(response.body).dig("document", "location")).to eq("Reports/Q1")
    end

    it "reports a nil location for a file at the root" do
      sign_in_user
      document = create(:document, user: user)

      get "/api/v1/documents/#{document.id}"

      expect(JSON.parse(response.body).dig("document", "location")).to be_nil
    end

    it "returns 404 for a document owned by someone else" do
      sign_in_user
      other = create(:document)

      get "/api/v1/documents/#{other.id}"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/documents/:id/versions/:version_id/restore" do
    it "rolls the current file back to the chosen version" do
      sign_in_user
      upload_note("old")
      document_id = JSON.parse(response.body).dig("document", "id")
      upload_note("new")
      version_id = user.documents.find(document_id).document_versions.sole.id

      post "/api/v1/documents/#{document_id}/versions/#{version_id}/restore"

      expect(response).to have_http_status(:ok)
      document = user.documents.find(document_id)
      expect(document.file.download).to eq("old")
      # The previously current "new" contents are kept as a version.
      expect(document.document_versions.sole.file.download).to eq("new")
    end

    it "returns 404 for a version that does not belong to the document" do
      sign_in_user
      upload_note("only")
      document_id = JSON.parse(response.body).dig("document", "id")
      foreign_version = create(:document_version)

      post "/api/v1/documents/#{document_id}/versions/#{foreign_version.id}/restore"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/documents/:id/download" do
    it "returns 401 when not signed in" do
      document = create(:document)
      get "/api/v1/documents/#{document.id}/download"
      expect(response).to have_http_status(:unauthorized)
    end

    it "streams the current file as an attachment" do
      sign_in_user
      upload_note("hello world", name: "note.txt")
      document_id = JSON.parse(response.body).dig("document", "id")

      get "/api/v1/documents/#{document_id}/download"

      expect(response).to have_http_status(:ok)
      expect(response.body).to eq("hello world")
      expect(response.headers["Content-Disposition"]).to include("attachment")
      expect(response.headers["Content-Disposition"]).to include("note.txt")
    end

    it "returns 404 for a document owned by someone else" do
      sign_in_user
      other = create(:document)

      get "/api/v1/documents/#{other.id}/download"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/documents/:id/versions/:version_id/download" do
    it "streams an older version as an attachment" do
      sign_in_user
      upload_note("old contents", name: "note.txt")
      document_id = JSON.parse(response.body).dig("document", "id")
      upload_note("new contents", name: "note.txt")
      version_id = user.documents.find(document_id).document_versions.sole.id

      get "/api/v1/documents/#{document_id}/versions/#{version_id}/download"

      expect(response).to have_http_status(:ok)
      expect(response.body).to eq("old contents")
      expect(response.headers["Content-Disposition"]).to include("v1-note.txt")
    end

    it "returns 404 for a version that does not belong to the document" do
      sign_in_user
      upload_note("only")
      document_id = JSON.parse(response.body).dig("document", "id")
      foreign_version = create(:document_version)

      get "/api/v1/documents/#{document_id}/versions/#{foreign_version.id}/download"

      expect(response).to have_http_status(:not_found)
    end
  end
end
