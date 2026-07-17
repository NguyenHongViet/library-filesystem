FactoryBot.define do
  factory :document do
    sequence(:name) { |n| "doc#{n}.pdf" }
    user
  end
end
