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
end
