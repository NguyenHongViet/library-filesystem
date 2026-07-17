class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :folders, dependent: :destroy
  has_many :documents, dependent: :destroy

  # Walks a slash-separated path, creating any missing folder along the way,
  # and returns the leaf folder. Used when restoring a file whose folder tree
  # was hard-deleted.
  def find_or_create_folder_path!(path)
    parent = nil
    path.split("/").reject(&:blank?).each do |name|
      parent = folders.find_or_create_by!(name: name, parent: parent)
    end
    parent
  end
end
