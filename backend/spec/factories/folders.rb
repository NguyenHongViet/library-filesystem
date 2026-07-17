FactoryBot.define do
  factory :folder do
    sequence(:name) { |n| "Folder #{n}" }
    user
  end
end
