# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

# Basic demo users so anyone who clones the repo can sign in right away.
# Credentials are documented in the project README.
users = [
  { email: "admin@example.com",  name: "Admin User",   role: "admin",  password: "password123" },
  { email: "alice@example.com",  name: "Alice Nguyen",  role: "member", password: "password123" },
  { email: "bob@example.com",    name: "Bob Tran",      role: "member", password: "password123" },
  { email: "carol@example.com",  name: "Carol Le",      role: "member", password: "password123" },
  { email: "dave@example.com",   name: "Dave Pham",     role: "member", password: "password123" }
]

users.each do |attrs|
  user = User.find_or_initialize_by(email: attrs[:email])
  user.name = attrs[:name]
  user.role = attrs[:role]
  user.password = attrs[:password]
  user.password_confirmation = attrs[:password]
  user.save!
end

puts "Seeded #{User.count} users."
