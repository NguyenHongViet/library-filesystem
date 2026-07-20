require 'rails_helper'

RSpec.describe Folder, type: :model do
  subject { build(:folder) }

  it { is_expected.to belong_to(:user) }
  it { is_expected.to belong_to(:parent).class_name('Folder').optional }
  it { is_expected.to have_many(:children).class_name('Folder').with_foreign_key(:parent_id).dependent(:destroy) }
  it { is_expected.to have_many(:documents).dependent(:destroy) }
  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to validate_uniqueness_of(:name).scoped_to(:user_id, :parent_id) }

  it 'defaults is_public to true (collaborative by default)' do
    expect(create(:folder).is_public).to be(true)
  end

  describe '.public_folders' do
    it 'returns only public folders' do
      public_folder = create(:folder, is_public: true)
      create(:folder, is_public: false)
      expect(described_class.public_folders).to contain_exactly(public_folder)
    end
  end

  describe '#path' do
    it 'joins the ancestor names with slashes' do
      grandparent = create(:folder, name: 'Projects')
      parent = create(:folder, name: '2026', parent: grandparent, user: grandparent.user)
      folder = create(:folder, name: 'Reports', parent: parent, user: grandparent.user)

      expect(folder.path).to eq('Projects/2026/Reports')
    end
  end

  describe '#destroy_and_trash_files!' do
    it 'hard-deletes the folder subtree' do
      folder = create(:folder)
      child = create(:folder, user: folder.user, parent: folder, name: 'Child')

      folder.destroy_and_trash_files!

      expect(described_class.exists?(folder.id)).to be(false)
      expect(described_class.exists?(child.id)).to be(false)
    end

    it 'keeps the contained files, detaching them and recording their old path' do
      folder = create(:folder, name: 'Reports')
      child = create(:folder, user: folder.user, parent: folder, name: 'Q1')
      top_doc = create(:document, user: folder.user, folder: folder, name: 'top.txt')
      nested_doc = create(:document, user: folder.user, folder: child, name: 'nested.txt')

      folder.destroy_and_trash_files!

      expect(top_doc.reload.folder_id).to be_nil
      expect(top_doc).to be_trashed
      expect(top_doc.deleted_path).to eq('Reports')

      expect(nested_doc.reload.folder_id).to be_nil
      expect(nested_doc).to be_trashed
      expect(nested_doc.deleted_path).to eq('Reports/Q1')
    end

    it 'preserves the earlier deletion time for files already in the trash' do
      folder = create(:folder, name: 'Reports')
      document = create(:document, user: folder.user, folder: folder)
      document.update_column(:deleted_at, 3.days.ago)
      original = document.reload.deleted_at

      folder.destroy_and_trash_files!

      expect(document.reload.deleted_at).to be_within(1.second).of(original)
      expect(document.deleted_path).to eq('Reports')
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
