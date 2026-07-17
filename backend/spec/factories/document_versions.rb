FactoryBot.define do
  factory :document_version do
    document
    sequence(:version_number) { |n| n }
  end
end
