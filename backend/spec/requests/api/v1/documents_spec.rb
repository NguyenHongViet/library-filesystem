require "rails_helper"

RSpec.describe "Api::V1::Documents", type: :request do
  let(:password) { "password123" }
  let(:user) { create(:user, password: password) }
  let(:upload) { fixture_file_upload("sample.txt", "text/plain") }

  def sign_in_user(account = user)
    post "/api/v1/login", params: { user: { email: account.email, password: password } }
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
end
