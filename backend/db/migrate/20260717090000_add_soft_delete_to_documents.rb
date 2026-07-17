class AddSoftDeleteToDocuments < ActiveRecord::Migration[8.1]
  def change
    # Only documents are soft-deleted. When a folder is hard-deleted its files
    # are kept and detached, with deleted_path recording where they used to live
    # so a restore can rebuild that folder chain.
    add_column :documents, :deleted_at, :datetime
    add_column :documents, :deleted_path, :string

    add_index :documents, :deleted_at
  end
end
