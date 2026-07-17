class Folder < ApplicationRecord
  belongs_to :user
  belongs_to :parent, class_name: "Folder", optional: true
  has_many :children, class_name: "Folder", foreign_key: :parent_id, dependent: :destroy
  has_many :documents, dependent: :destroy

  validates :name, presence: true
  validates :name, uniqueness: { scope: [:user_id, :parent_id] }

  scope :public_folders, -> { where(is_public: true) }

  # Ancestors ordered from the root down to (and including) this folder.
  def self_and_ancestors
    chain = [ self ]
    node = parent
    while node
      chain.unshift(node)
      node = node.parent
    end
    chain
  end
end
