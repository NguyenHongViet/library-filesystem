require 'rails_helper'

RSpec.describe User, type: :model do
  subject { build(:user) }

  it { is_expected.to validate_presence_of(:email) }
  it { is_expected.to validate_uniqueness_of(:email).case_insensitive }
  it { is_expected.to have_many(:folders).dependent(:destroy) }
  it { is_expected.to have_many(:documents).dependent(:destroy) }

  it 'defaults role to "member"' do
    expect(create(:user).role).to eq('member')
  end
end
