require "rails_helper"

RSpec.describe "Api::V1::Account", type: :request do
  let(:password) { "password123" }
  let(:user) { create(:user, password: password) }

  def sign_in_user(account = user)
    post "/api/v1/login", params: { user: { email: account.email, password: password } }
  end

  describe "PATCH /api/v1/account/password" do
    it "returns 401 when not signed in" do
      patch "/api/v1/account/password", params: { current_password: password, password: "newsecret1" }
      expect(response).to have_http_status(:unauthorized)
    end

    it "changes the password when the current one is correct" do
      sign_in_user

      patch "/api/v1/account/password", params: { current_password: password, password: "newsecret1" }

      expect(response).to have_http_status(:ok)
      expect(user.reload.valid_password?("newsecret1")).to be(true)
    end

    it "keeps the session valid after changing the password" do
      sign_in_user

      patch "/api/v1/account/password", params: { current_password: password, password: "newsecret1" }
      get "/api/v1/me"

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig("user", "id")).to eq(user.id)
    end

    it "returns 422 when the current password is wrong" do
      sign_in_user

      patch "/api/v1/account/password", params: { current_password: "wrongpass", password: "newsecret1" }

      expect(response).to have_http_status(:unprocessable_content)
      expect(user.reload.valid_password?(password)).to be(true)
    end

    it "returns 422 when the new password is too short" do
      sign_in_user

      patch "/api/v1/account/password", params: { current_password: password, password: "123" }

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "DELETE /api/v1/account" do
    it "returns 401 when not signed in" do
      delete "/api/v1/account"
      expect(response).to have_http_status(:unauthorized)
    end

    it "deletes the current user's account and ends the session" do
      sign_in_user
      user_id = user.id

      expect do
        delete "/api/v1/account"
      end.to change(User, :count).by(-1)

      expect(response).to have_http_status(:no_content)
      expect(User.exists?(user_id)).to be(false)

      get "/api/v1/me"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
