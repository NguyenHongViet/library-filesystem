class CreateFolders < ActiveRecord::Migration[8.1]
  def change
    create_table :folders do |t|
      t.string :name, null: false
      t.references :parent, null: true, foreign_key: { to_table: :folders, on_delete: :cascade }
      t.references :user, null: false, foreign_key: true, index: false
      t.boolean :is_public, null: false, default: false

      t.timestamps
    end

    add_index :folders, [:user_id, :parent_id, :name], unique: true
    add_index :folders, :is_public
  end
end
