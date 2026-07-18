require "rails_helper"

RSpec.describe "Api::V1::Search", type: :request do
  let(:password) { "password123" }
  let(:user) { create(:user, password: password) }

  def sign_in_user(account = user)
    post "/api/v1/login", params: { user: { email: account.email, password: password } }
  end

  describe "GET /api/v1/search" do
    it "returns 401 when not signed in" do
      get "/api/v1/search", params: { q: "x" }
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns empty results for a blank query" do
      sign_in_user
      create(:folder, user: user, name: "Reports")

      get "/api/v1/search", params: { q: "  " }

      body = JSON.parse(response.body)
      expect(body["folders"]).to be_empty
      expect(body["documents"]).to be_empty
    end

    it "matches folders and files by name across the whole library" do
      sign_in_user
      reports = create(:folder, user: user, name: "Reports")
      create(:folder, user: user, name: "Archive")
      create(:document, user: user, name: "report-2026.txt", folder: reports)
      create(:document, user: user, name: "notes.txt")
      create(:document, name: "report-other.txt") # another user's file

      get "/api/v1/search", params: { q: "report" }

      body = JSON.parse(response.body)
      expect(body["folders"].map { |f| f["name"] }).to eq([ "Reports" ])
      expect(body["documents"].map { |d| d["name"] }).to eq([ "report-2026.txt" ])
    end

    it "is case-insensitive and includes the location of each match" do
      sign_in_user
      reports = create(:folder, user: user, name: "Reports")
      create(:document, user: user, name: "Summary.txt", folder: reports)

      get "/api/v1/search", params: { q: "summary" }

      document = JSON.parse(response.body)["documents"].first
      expect(document["name"]).to eq("Summary.txt")
      expect(document["location"]).to eq("Reports")
    end

    it "excludes trashed files" do
      sign_in_user
      create(:document, user: user, name: "report.txt").soft_delete!

      get "/api/v1/search", params: { q: "report" }

      expect(JSON.parse(response.body)["documents"]).to be_empty
    end

    it "treats LIKE wildcards as literal characters" do
      sign_in_user
      create(:document, user: user, name: "100%done.txt")
      create(:document, user: user, name: "plain.txt")

      get "/api/v1/search", params: { q: "100%" }

      names = JSON.parse(response.body)["documents"].map { |d| d["name"] }
      expect(names).to eq([ "100%done.txt" ])
    end
  end

  describe "GET /api/v1/shared/users/:user_id/search" do
    let(:owner) { create(:user, name: "Owner") }

    it "returns 401 when not signed in" do
      get "/api/v1/shared/users/#{owner.id}/search", params: { q: "x" }
      expect(response).to have_http_status(:unauthorized)
    end

    it "matches only the owner's public content by name" do
      sign_in_user
      create(:folder, user: owner, name: "Public reports", is_public: true)
      create(:folder, user: owner, name: "Private reports", is_public: false)
      create(:document, user: owner, name: "report-public.txt", is_public: true)
      create(:document, user: owner, name: "report-private.txt", is_public: false)

      get "/api/v1/shared/users/#{owner.id}/search", params: { q: "report" }

      body = JSON.parse(response.body)
      expect(body["folders"].map { |f| f["name"] }).to eq([ "Public reports" ])
      expect(body["documents"].map { |d| d["name"] }).to eq([ "report-public.txt" ])
    end

    it "returns empty results for a blank query" do
      sign_in_user
      create(:document, user: owner, name: "report.txt", is_public: true)

      get "/api/v1/shared/users/#{owner.id}/search", params: { q: "" }

      expect(JSON.parse(response.body)["documents"]).to be_empty
    end

    it "returns 404 for an unknown user" do
      sign_in_user
      get "/api/v1/shared/users/0/search", params: { q: "x" }
      expect(response).to have_http_status(:not_found)
    end
  end
end
