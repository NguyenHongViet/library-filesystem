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
end
