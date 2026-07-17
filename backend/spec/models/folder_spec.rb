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

  describe '#self_and_ancestors' do
    it 'returns just itself for a root folder' do
      folder = create(:folder)
      expect(folder.self_and_ancestors).to eq([ folder ])
    end

    it 'returns the chain ordered from the root down to itself' do
      grandparent = create(:folder, name: 'Grandparent')
      parent = create(:folder, name: 'Parent', parent: grandparent, user: grandparent.user)
      folder = create(:folder, name: 'Child', parent: parent, user: grandparent.user)

      expect(folder.self_and_ancestors).to eq([ grandparent, parent, folder ])
    end
  end
end
