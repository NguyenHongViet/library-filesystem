require "rails_helper"

RSpec.describe "Api::V1::Trash", type: :request do
  let(:password) { "password123" }
  let(:user) { create(:user, password: password) }

  def sign_in_user(account = user)
    post "/api/v1/login", params: { user: { email: account.email, password: password } }
  end

  describe "GET /api/v1/trash" do
    it "returns 401 when not signed in" do
      get "/api/v1/trash"
      expect(response).to have_http_status(:unauthorized)
    end

    it "lists the current user's trashed documents with their old path" do
      sign_in_user
      folder = create(:folder, user: user, name: "Reports")
      create(:document, user: user, folder: folder, name: "in-folder.txt")
      directly = create(:document, user: user, name: "loose.txt")
      directly.soft_delete!
      create(:document, user: user, name: "kept.txt")
      delete "/api/v1/folders/#{folder.id}"

      get "/api/v1/trash"

      expect(response).to have_http_status(:ok)
      documents = JSON.parse(response.body)["documents"]
      names = documents.map { |d| d["name"] }
      expect(names).to contain_exactly("in-folder.txt", "loose.txt")

      from_folder = documents.find { |d| d["name"] == "in-folder.txt" }
      expect(from_folder["deleted_path"]).to eq("Reports")
    end

    it "does not leak another user's trash" do
      sign_in_user
      other_document = create(:document, name: "Other")
      other_document.soft_delete!

      get "/api/v1/trash"

      expect(JSON.parse(response.body)["documents"]).to be_empty
    end
  end
end
