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

  describe '#overwrite_with!' do
    def build_upload(content, name: 'note.txt')
      Rack::Test::UploadedFile.new(StringIO.new(content), 'text/plain', original_filename: name)
    end

    def attach_current(document, content)
      document.file.attach(io: StringIO.new(content), filename: 'note.txt', content_type: 'text/plain')
    end

    it 'attaches the file without creating a version when none existed' do
      document = create(:document)

      document.overwrite_with!(build_upload('first'), user: document.user)

      expect(document.file.download).to eq('first')
      expect(document.document_versions).to be_empty
    end

    it 'archives the previous contents and records the uploader' do
      document = create(:document)
      attach_current(document, 'old')
      uploader = create(:user)

      changed = document.overwrite_with!(build_upload('new'), user: uploader)

      expect(changed).to be(true)
      expect(document.file.download).to eq('new')
      version = document.document_versions.sole
      expect(version.file.download).to eq('old')
      expect(version.user).to eq(uploader)
      expect(version.version_number).to eq(1)
    end

    it 'is a no-op when the uploaded content is identical to the current file' do
      document = create(:document)
      attach_current(document, 'same bytes')
      original_blob_id = document.file.blob.id

      changed = document.overwrite_with!(build_upload('same bytes'), user: document.user)

      expect(changed).to be(false)
      expect(document.document_versions).to be_empty
      expect(document.reload.file.blob.id).to eq(original_blob_id)
    end

    it 'updates the stored size to match the new upload' do
      document = create(:document)
      attach_current(document, 'old')

      document.overwrite_with!(build_upload('a much longer body'), user: document.user)

      expect(document.byte_size).to eq('a much longer body'.bytesize)
    end

    it 'retains at most MAX_VERSIONS states, pruning the oldest' do
      document = create(:document)
      attach_current(document, 'v0')

      7.times { |i| document.overwrite_with!(build_upload("v#{i + 1}"), user: document.user) }

      expect(document.document_versions.count).to eq(Document::MAX_VERSIONS - 1)
      expect(document.document_versions.minimum(:version_number)).to eq(4)
      expect(document.reload.file.download).to eq('v7')
    end
  end

  describe '#restore_version!' do
    def build_upload(content, name: 'note.txt')
      Rack::Test::UploadedFile.new(StringIO.new(content), 'text/plain', original_filename: name)
    end

    it 'promotes the chosen version to the current file and archives the current one' do
      document = create(:document)
      document.file.attach(io: StringIO.new('v0'), filename: 'note.txt', content_type: 'text/plain')
      document.overwrite_with!(build_upload('v1'), user: document.user)
      version = document.document_versions.sole

      document.restore_version!(version, user: document.user)

      expect(document.reload.file.download).to eq('v0')
      expect(DocumentVersion.exists?(version.id)).to be(false)
      expect(document.document_versions.map { |v| v.file.download }).to contain_exactly('v1')
    end
  end
end
