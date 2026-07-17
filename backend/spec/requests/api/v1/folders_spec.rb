require "rails_helper"

RSpec.describe "Api::V1::Folders", type: :request do
  let(:password) { "password123" }
  let(:user) { create(:user, password: password) }

  def sign_in_user(account = user)
    post "/api/v1/login", params: { user: { email: account.email, password: password } }
  end

  describe "GET /api/v1/folders" do
    it "returns 401 when not signed in" do
      get "/api/v1/folders"
      expect(response).to have_http_status(:unauthorized)
    end

    it "lists only the current user's root folders ordered by name" do
      sign_in_user
      parent = create(:folder, user: user, name: "Parent")
      create(:folder, user: user, name: "Beta")
      create(:folder, user: user, name: "Alpha")
      create(:folder, user: user, name: "Child", parent: parent)
      create(:folder, name: "Other User Folder")

      get "/api/v1/folders"

      expect(response).to have_http_status(:ok)
      names = JSON.parse(response.body)["folders"].map { |f| f["name"] }
      expect(names).to eq([ "Alpha", "Beta", "Parent" ])
    end

    it "scopes folders to a parent when parent_id is given" do
      sign_in_user
      parent = create(:folder, user: user, name: "Parent")
      create(:folder, user: user, name: "Child", parent: parent)
      create(:folder, user: user, name: "Root")

      get "/api/v1/folders", params: { parent_id: parent.id }

      names = JSON.parse(response.body)["folders"].map { |f| f["name"] }
      expect(names).to eq([ "Child" ])
    end
  end

  describe "GET /api/v1/folders/:id" do
    it "returns 401 when not signed in" do
      folder = create(:folder)
      get "/api/v1/folders/#{folder.id}"
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns the folder and its breadcrumb from root to self" do
      sign_in_user
      grandparent = create(:folder, user: user, name: "Grandparent")
      parent = create(:folder, user: user, name: "Parent", parent: grandparent)
      folder = create(:folder, user: user, name: "Current", parent: parent)

      get "/api/v1/folders/#{folder.id}"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig("folder", "id")).to eq(folder.id)
      expect(body["breadcrumb"].map { |f| f["name"] }).to eq([ "Grandparent", "Parent", "Current" ])
    end

    it "returns 404 for a folder owned by someone else" do
      sign_in_user
      other = create(:folder)
      get "/api/v1/folders/#{other.id}"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/folders" do
    it "returns 401 when not signed in" do
      post "/api/v1/folders", params: { name: "New" }
      expect(response).to have_http_status(:unauthorized)
    end

    it "creates a root folder for the current user" do
      sign_in_user

      expect do
        post "/api/v1/folders", params: { name: "Reports" }
      end.to change(user.folders, :count).by(1)

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)["folder"]
      expect(body["name"]).to eq("Reports")
      expect(body["parent_id"]).to be_nil
    end

    it "creates a nested folder under a parent the user owns" do
      sign_in_user
      parent = create(:folder, user: user)

      post "/api/v1/folders", params: { name: "Nested", parent_id: parent.id }

      expect(response).to have_http_status(:created)
      expect(JSON.parse(response.body).dig("folder", "parent_id")).to eq(parent.id)
    end

    it "returns 404 when the parent belongs to someone else" do
      sign_in_user
      other_parent = create(:folder)

      post "/api/v1/folders", params: { name: "Nested", parent_id: other_parent.id }

      expect(response).to have_http_status(:not_found)
    end

    it "returns 422 when the name is blank" do
      sign_in_user
      post "/api/v1/folders", params: { name: "" }
      expect(response).to have_http_status(:unprocessable_content)
      expect(JSON.parse(response.body)["errors"]).to include("Name can't be blank")
    end

    it "returns 422 when a sibling folder already has the same name" do
      sign_in_user
      create(:folder, user: user, name: "Dup")

      post "/api/v1/folders", params: { name: "Dup" }

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "PATCH /api/v1/folders/:id" do
    it "returns 401 when not signed in" do
      folder = create(:folder)
      patch "/api/v1/folders/#{folder.id}", params: { is_public: true }
      expect(response).to have_http_status(:unauthorized)
    end

    it "toggles the public flag on a folder the user owns" do
      sign_in_user
      folder = create(:folder, user: user, is_public: false)

      patch "/api/v1/folders/#{folder.id}", params: { is_public: true }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig("folder", "is_public")).to be(true)
      expect(folder.reload.is_public).to be(true)
    end

    it "can flip a public folder back to private" do
      sign_in_user
      folder = create(:folder, user: user, is_public: true)

      patch "/api/v1/folders/#{folder.id}", params: { is_public: false }

      expect(folder.reload.is_public).to be(false)
    end

    it "returns 404 for a folder owned by someone else" do
      sign_in_user
      other = create(:folder)

      patch "/api/v1/folders/#{other.id}", params: { is_public: true }

      expect(response).to have_http_status(:not_found)
    end
  end
end
