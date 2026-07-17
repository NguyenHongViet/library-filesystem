class Document < ApplicationRecord
  belongs_to :user
  belongs_to :folder, optional: true
  belongs_to :copied_from, class_name: "Document", optional: true
  has_many :copies, class_name: "Document", foreign_key: :copied_from_id, dependent: :nullify
  has_many :document_versions, dependent: :destroy
  has_one_attached :file

  validates :name, presence: true

  scope :public_documents, -> { where(is_public: true) }
end
