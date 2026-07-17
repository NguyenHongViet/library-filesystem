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
end
