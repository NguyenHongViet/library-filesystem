class DocumentVersion < ApplicationRecord
  belongs_to :document
  belongs_to :user, optional: true
  has_one_attached :file

  validates :version_number, presence: true, uniqueness: { scope: :document_id }
end
