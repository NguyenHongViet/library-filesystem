class Document < ApplicationRecord
  belongs_to :user
  belongs_to :folder, optional: true
  belongs_to :copied_from, class_name: "Document", optional: true
  has_many :copies, class_name: "Document", foreign_key: :copied_from_id, dependent: :nullify
  has_many :document_versions, dependent: :destroy
  has_one_attached :file

  validates :name, presence: true

  # A file retains its current contents plus a bounded history of previous
  # uploads: at most MAX_VERSIONS states in total (current + archived history).
  MAX_VERSIONS = 5

  scope :public_documents, -> { where(is_public: true) }
  scope :kept, -> { where(deleted_at: nil) }
  scope :trashed, -> { where.not(deleted_at: nil) }

  def trashed?
    deleted_at.present?
  end

  def soft_delete!(time = Time.current)
    update!(deleted_at: time)
  end

  # Restores the document. If its folder was hard-deleted, deleted_path holds
  # the old location and the folder chain is recreated on the way back.
  def restore!
    transaction do
      self.folder = user.find_or_create_folder_path!(deleted_path) if deleted_path.present?
      update!(deleted_at: nil, deleted_path: nil)
    end
  end

  # Overwrites the current file with a freshly uploaded one, archiving the
  # previous contents as an older version and trimming history to MAX_VERSIONS.
  # Re-uploading identical bytes is a no-op (no redundant version is stored),
  # detected by comparing the upload's checksum with the current blob's.
  # Returns true when the file changed, false when the upload was a duplicate.
  def overwrite_with!(uploaded, user:)
    return false if file.attached? && content_checksum(uploaded) == file.blob.checksum

    transaction do
      archive_current_version!(user) if file.attached?
      file.attach(uploaded)
      update!(content_type: uploaded.content_type, byte_size: uploaded.size)
      prune_versions!
    end
    true
  end

  # Rolls the current file back to a stored version. The current contents are
  # archived as a new version first, so nothing is lost, and the promoted
  # version's row is consumed since its contents are now the live file.
  def restore_version!(version, user:)
    transaction do
      target_blob = version.file.blob
      version.file.detach
      version.destroy!
      archive_current_version!(user) if file.attached?
      file.attach(target_blob)
      update!(content_type: target_blob.content_type, byte_size: target_blob.byte_size)
      prune_versions!
    end
  end

  # Creates an independent copy of this file in `owner`'s library. The copy is
  # a brand-new file (its own blob, no version history) that links back to the
  # source via copied_from. If a file with the same name already exists in the
  # destination, the copy is renamed ("report.txt" -> "report (1).txt") so the
  # existing file is never overwritten.
  def copy_to!(owner:, folder:)
    copy = owner.documents.new(
      name: available_name_in(owner, folder),
      folder: folder,
      content_type: content_type,
      byte_size: byte_size,
      copied_from: self
    )
    copy.file.attach(duplicate_blob) if file.attached?
    copy.save!
    copy
  end

  private

  def available_name_in(owner, folder)
    taken = owner.documents.kept.where(folder_id: folder&.id).pluck(:name)
    return name unless taken.include?(name)

    extension = File.extname(name)
    base = File.basename(name, extension)
    counter = 1
    counter += 1 while taken.include?("#{base} (#{counter})#{extension}")
    "#{base} (#{counter})#{extension}"
  end

  def duplicate_blob
    ActiveStorage::Blob.create_and_upload!(
      io: StringIO.new(file.download),
      filename: file.blob.filename.to_s,
      content_type: file.blob.content_type
    )
  end

  def archive_current_version!(user)
    old_blob = file.blob
    next_number = (document_versions.maximum(:version_number) || 0) + 1
    # Detach (not purge) so the blob survives to back the archived version.
    file.detach
    version = document_versions.create!(
      user: user,
      version_number: next_number,
      byte_size: old_blob.byte_size,
      content_type: old_blob.content_type
    )
    version.file.attach(old_blob)
  end

  def prune_versions!
    document_versions
      .order(version_number: :desc)
      .offset(MAX_VERSIONS - 1)
      .each(&:destroy!)
  end

  # Base64 MD5, matching the format Active Storage stores in blob.checksum.
  def content_checksum(uploaded)
    uploaded.rewind
    digest = OpenSSL::Digest::MD5.new
    buffer = "".b
    digest.update(buffer) while uploaded.read(5.megabytes, buffer)
    digest.base64digest
  ensure
    uploaded.rewind
  end
end
