class CreateDocuments < ActiveRecord::Migration[8.1]
  def change
    create_table :documents do |t|
      t.string :name, null: false
      t.references :folder, null: true, foreign_key: { on_delete: :cascade }
      t.references :user, null: false, foreign_key: true
      t.text :description
      t.boolean :is_public, null: false, default: false
      t.string :content_type
      t.bigint :byte_size
      t.references :copied_from, null: true, foreign_key: { to_table: :documents, on_delete: :nullify }

      t.timestamps
    end

    add_index :documents, :is_public
  end
end
