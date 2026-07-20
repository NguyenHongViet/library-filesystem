class MakeFilesPublicByDefault < ActiveRecord::Migration[8.1]
  # The library is collaborative: newly created files and folders are visible to
  # everyone by default, and the owner can switch any of them to private.
  # Existing rows keep whatever visibility they already have.
  def change
    change_column_default :documents, :is_public, from: false, to: true
    change_column_default :folders, :is_public, from: false, to: true
  end
end
