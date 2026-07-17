class Document < ApplicationRecord
  belongs_to :user
  belongs_to :folder, optional: true
  belongs_to :copied_from, class_name: "Document", optional: true
  has_many :copies, class_name: "Document", foreign_key: :copied_from_id, dependent: :nullify
  has_many :document_versions, dependent: :destroy
  has_one_attached :file

  validates :name, presence: true

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
end
