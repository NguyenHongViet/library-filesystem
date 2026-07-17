require 'rails_helper'

RSpec.describe Folder, type: :model do
  subject { build(:folder) }

  it { is_expected.to belong_to(:user) }
  it { is_expected.to belong_to(:parent).class_name('Folder').optional }
  it { is_expected.to have_many(:children).class_name('Folder').with_foreign_key(:parent_id).dependent(:destroy) }
  it { is_expected.to have_many(:documents).dependent(:destroy) }
  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to validate_uniqueness_of(:name).scoped_to(:user_id, :parent_id) }

  it 'defaults is_public to false' do
    expect(create(:folder).is_public).to be(false)
  end

  describe '.public_folders' do
    it 'returns only public folders' do
      public_folder = create(:folder, is_public: true)
      create(:folder)
      expect(described_class.public_folders).to contain_exactly(public_folder)
    end
  end
end
