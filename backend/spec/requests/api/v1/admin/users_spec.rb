require "rails_helper"

RSpec.describe "Api::V1::Admin::Users", type: :request do
  let(:password) { "password123" }
  let(:admin) { create(:user, :admin, password: password) }
  let(:member) { create(:user, password: password) }

  def sign_in_user(account)
    post "/api/v1/login", params: { user: { email: account.email, password: password } }
  end

  describe "GET /api/v1/admin/users" do
    it "returns 401 when not signed in" do
      get "/api/v1/admin/users"
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 403 for a non-admin" do
      sign_in_user(member)
      get "/api/v1/admin/users"
      expect(response).to have_http_status(:forbidden)
    end

    it "lists all users for an admin" do
      sign_in_user(admin)
      create(:user, email: "zoe@example.com", name: "Zoe")

      get "/api/v1/admin/users"

      expect(response).to have_http_status(:ok)
      emails = JSON.parse(response.body)["users"].map { |u| u["email"] }
      expect(emails).to include(admin.email, "zoe@example.com")
    end
  end

  describe "POST /api/v1/admin/users" do
    it "returns 403 for a non-admin" do
      sign_in_user(member)
      post "/api/v1/admin/users", params: { email: "new@example.com", password: password }
      expect(response).to have_http_status(:forbidden)
    end

    it "creates a user with the given role" do
      sign_in_user(admin)

      expect do
        post "/api/v1/admin/users", params: {
          email: "new@example.com", name: "New User", role: "admin", password: password
        }
      end.to change(User, :count).by(1)

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)["user"]
      expect(body["email"]).to eq("new@example.com")
      expect(body["role"]).to eq("admin")
      expect(User.find(body["id"]).valid_password?(password)).to be(true)
    end

    it "returns 422 for invalid attributes" do
      sign_in_user(admin)

      post "/api/v1/admin/users", params: { email: "", password: "" }

      expect(response).to have_http_status(:unprocessable_content)
      expect(JSON.parse(response.body)["errors"]).to be_present
    end

    it "returns 422 for an invalid role" do
      sign_in_user(admin)

      post "/api/v1/admin/users", params: { email: "x@example.com", password: password, role: "superuser" }

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "PATCH /api/v1/admin/users/:id" do
    it "updates a user's name, email and role" do
      sign_in_user(admin)
      target = create(:user, name: "Old", email: "old@example.com")

      patch "/api/v1/admin/users/#{target.id}", params: {
        name: "New", email: "updated@example.com", role: "admin"
      }

      expect(response).to have_http_status(:ok)
      target.reload
      expect(target.name).to eq("New")
      expect(target.email).to eq("updated@example.com")
      expect(target.role).to eq("admin")
    end

    it "leaves the password unchanged when none is given" do
      sign_in_user(admin)
      target = create(:user, password: "password123")

      patch "/api/v1/admin/users/#{target.id}", params: { name: "Renamed" }

      expect(response).to have_http_status(:ok)
      expect(target.reload.valid_password?("password123")).to be(true)
    end

    it "changes the password when one is provided" do
      sign_in_user(admin)
      target = create(:user)

      patch "/api/v1/admin/users/#{target.id}", params: { password: "newsecret1" }

      expect(response).to have_http_status(:ok)
      expect(target.reload.valid_password?("newsecret1")).to be(true)
    end

    it "returns 404 for an unknown user" do
      sign_in_user(admin)
      patch "/api/v1/admin/users/0", params: { name: "X" }
      expect(response).to have_http_status(:not_found)
    end

    it "returns 403 for a non-admin" do
      sign_in_user(member)
      patch "/api/v1/admin/users/#{member.id}", params: { name: "X" }
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE /api/v1/admin/users/:id" do
    it "deletes another user" do
      sign_in_user(admin)
      target = create(:user)

      expect do
        delete "/api/v1/admin/users/#{target.id}"
      end.to change(User, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end

    it "refuses to delete the current admin's own account" do
      sign_in_user(admin)

      delete "/api/v1/admin/users/#{admin.id}"

      expect(response).to have_http_status(:unprocessable_content)
      expect(User.exists?(admin.id)).to be(true)
    end

    it "returns 403 for a non-admin" do
      sign_in_user(member)
      other = create(:user)
      delete "/api/v1/admin/users/#{other.id}"
      expect(response).to have_http_status(:forbidden)
    end
  end
end
