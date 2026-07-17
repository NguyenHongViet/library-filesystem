class MakeFoldersNameIndexNullsNotDistinct < ActiveRecord::Migration[8.1]
  # Root folders have a NULL parent_id; by default Postgres treats NULLs as
  # distinct, so the unique index would not block duplicate root folder names.
  def change
    remove_index :folders, column: [:user_id, :parent_id, :name], unique: true
    add_index :folders, [:user_id, :parent_id, :name], unique: true, nulls_not_distinct: true
  end
end
