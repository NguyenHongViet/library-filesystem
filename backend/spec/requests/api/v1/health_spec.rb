require "rails_helper"

RSpec.describe "Api::V1::Health", type: :request do
  describe "GET /api/v1/ping" do
    before { get "/api/v1/ping" }

    it "returns 200 OK" do
      expect(response).to have_http_status(:ok)
    end

    it "returns the expected JSON payload" do
      body = JSON.parse(response.body)
      expect(body).to include(
        "status" => "ok",
        "service" => "library-filesystem-api",
        "rails_env" => "test"
      )
      expect(body["time"]).to be_present
    end
  end
end
