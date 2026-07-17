require "rails_helper"

RSpec.describe "db/seeds.rb" do
  def load_seeds
    load Rails.root.join("db", "seeds.rb")
  end

  it "creates the five demo users" do
    expect { load_seeds }.to change(User, :count).by(5)
  end

  it "creates one admin and four members" do
    load_seeds
    expect(User.where(role: "admin").pluck(:email)).to eq(["admin@example.com"])
    expect(User.where(role: "member").count).to eq(4)
  end

  it "creates users that can authenticate with the documented password" do
    load_seeds
    expect(User.find_by(email: "admin@example.com").valid_password?("password123")).to be(true)
  end

  it "is idempotent" do
    load_seeds
    expect { load_seeds }.not_to change(User, :count)
  end
end
