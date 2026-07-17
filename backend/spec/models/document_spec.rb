require 'rails_helper'

RSpec.describe Document, type: :model do
  subject { build(:document) }

  it { is_expected.to belong_to(:user) }
  it { is_expected.to belong_to(:folder).optional }
  it { is_expected.to belong_to(:copied_from).class_name('Document').optional }
  it { is_expected.to have_many(:copies).class_name('Document').with_foreign_key(:copied_from_id).dependent(:nullify) }
  it { is_expected.to have_many(:document_versions).dependent(:destroy) }
  it { is_expected.to have_one_attached(:file) }
  it { is_expected.to validate_presence_of(:name) }

  it 'defaults is_public to false' do
    expect(create(:document).is_public).to be(false)
  end

  it 'nullifies copies when the source is destroyed' do
    source = create(:document)
    copy = create(:document, copied_from: source)
    source.destroy
    expect(copy.reload.copied_from_id).to be_nil
  end

  describe '.public_documents' do
    it 'returns only public documents' do
      public_doc = create(:document, is_public: true)
      create(:document)
      expect(described_class.public_documents).to contain_exactly(public_doc)
    end
  end

  describe 'soft delete' do
    it 'is kept by default and moves to trashed after soft_delete!' do
      document = create(:document)
      expect(document.trashed?).to be(false)
      expect(described_class.kept).to include(document)

      document.soft_delete!

      expect(document.reload.trashed?).to be(true)
      expect(described_class.trashed).to include(document)
      expect(described_class.kept).not_to include(document)
    end

    it 'restores a directly-deleted document in place' do
      folder = create(:folder)
      document = create(:document, user: folder.user, folder: folder)
      document.soft_delete!

      document.restore!

      expect(document.reload.trashed?).to be(false)
      expect(document.folder_id).to eq(folder.id)
    end

    it 'rebuilds the old folder path when restoring a document whose folder was deleted' do
      user = create(:user)
      document = create(:document, user: user)
      document.update!(deleted_at: Time.current, deleted_path: 'Reports/Q1', folder: nil)

      document.restore!

      expect(document.reload).not_to be_trashed
      expect(document.deleted_path).to be_nil
      expect(document.folder.path).to eq('Reports/Q1')
    end
  end
end
