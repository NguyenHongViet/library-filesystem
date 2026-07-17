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

  describe '#find_or_create_folder_path!' do
    let(:user) { create(:user) }

    it 'creates the whole folder chain and returns the leaf' do
      leaf = user.find_or_create_folder_path!('Projects/2026/Reports')

      expect(leaf.name).to eq('Reports')
      expect(leaf.parent.name).to eq('2026')
      expect(leaf.parent.parent.name).to eq('Projects')
      expect(leaf.parent.parent.parent).to be_nil
      expect(user.folders.count).to eq(3)
    end

    it 'reuses existing folders instead of duplicating them' do
      existing = create(:folder, user: user, name: 'Projects')

      leaf = user.find_or_create_folder_path!('Projects/2026')

      expect(leaf.parent).to eq(existing)
      expect(user.folders.where(name: 'Projects').count).to eq(1)
    end

    it 'creates the chain under a given parent folder' do
      base = create(:folder, user: user, name: 'Base')

      leaf = user.find_or_create_folder_path!('Sub/Deep', parent: base)

      expect(leaf.name).to eq('Deep')
      expect(leaf.parent.name).to eq('Sub')
      expect(leaf.parent.parent).to eq(base)
    end
  end
end
