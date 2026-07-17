require "rails_helper"

RSpec.describe "Api::V1::Sessions", type: :request do
  let(:password) { "password123" }
  let(:user) { create(:user, email: "session@example.com", password: password, name: "Session User") }

  describe "POST /api/v1/login" do
    context "with valid credentials" do
      before do
        post "/api/v1/login", params: { user: { email: user.email, password: password } }
      end

      it "returns 200 OK" do
        expect(response).to have_http_status(:ok)
      end

      it "returns the authenticated user" do
        body = JSON.parse(response.body)
        expect(body["user"]).to include(
          "id" => user.id,
          "email" => user.email,
          "name" => user.name,
          "role" => user.role
        )
      end

      it "starts a session usable by protected endpoints" do
        get "/api/v1/me"
        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body).dig("user", "email")).to eq(user.email)
      end
    end

    context "with a case-insensitive email" do
      it "authenticates the user" do
        post "/api/v1/login", params: { user: { email: user.email.upcase, password: password } }
        expect(response).to have_http_status(:ok)
      end
    end

    context "with a wrong password" do
      before do
        post "/api/v1/login", params: { user: { email: user.email, password: "wrong" } }
      end

      it "returns 401 Unauthorized" do
        expect(response).to have_http_status(:unauthorized)
      end

      it "returns an error message" do
        expect(JSON.parse(response.body)["error"]).to eq("Invalid email or password.")
      end
    end

    context "with an unknown email" do
      it "returns 401 Unauthorized" do
        post "/api/v1/login", params: { user: { email: "nobody@example.com", password: password } }
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "GET /api/v1/me" do
    it "returns 401 when not signed in" do
      get "/api/v1/me"
      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body)["error"]).to be_present
    end

    it "returns the current user when signed in" do
      post "/api/v1/login", params: { user: { email: user.email, password: password } }
      get "/api/v1/me"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig("user", "id")).to eq(user.id)
    end
  end

  describe "DELETE /api/v1/logout" do
    it "clears the session" do
      post "/api/v1/login", params: { user: { email: user.email, password: password } }

      delete "/api/v1/logout"
      expect(response).to have_http_status(:no_content)

      get "/api/v1/me"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
