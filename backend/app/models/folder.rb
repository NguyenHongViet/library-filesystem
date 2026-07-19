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

  # Slash-separated path from the root, e.g. "Projects/2026/Reports".
  def path
    self_and_ancestors.map(&:name).join("/")
  end

  def self_and_descendants
    [ self ] + children.flat_map(&:self_and_descendants)
  end

  # Copies this folder's subtree into `owner`'s library under `parent`,
  # recreating the structure. Only public files/subfolders are copied unless
  # include_private is set (an admin action). Each file becomes a fresh copy
  # (no version history). A same-named folder in the destination is reused
  # rather than duplicated.
  def copy_to!(owner:, parent:, include_private: false)
    new_folder = owner.folders.find_or_create_by!(name: name, parent: parent)

    copyable_documents = include_private ? documents.kept : documents.public_documents.kept
    copyable_documents.find_each do |document|
      document.copy_to!(owner: owner, folder: new_folder)
    end

    copyable_children = include_private ? children : children.public_folders
    copyable_children.find_each do |child|
      child.copy_to!(owner: owner, parent: new_folder, include_private: include_private)
    end

    new_folder
  end

  # Hard-deletes the folder subtree, but first soft-deletes the documents it
  # holds and records their old path so they can be restored later. Detaching
  # each document (folder_id: nil) is what keeps it out of the folder's
  # `dependent: :destroy` cascade below.
  def destroy_and_trash_files!(time = Time.current)
    transaction do
      path_by_id = self_and_descendants.to_h { |folder| [ folder.id, folder.path ] }

      Document.where(folder_id: path_by_id.keys).find_each do |document|
        document.update!(
          deleted_at: document.deleted_at || time,
          deleted_path: path_by_id[document.folder_id],
          folder_id: nil
        )
      end

      destroy!
    end
  end
end
