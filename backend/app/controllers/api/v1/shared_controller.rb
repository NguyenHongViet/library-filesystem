require "zip"

module Api
  module V1
    class SharedController < ApplicationController
      before_action :authenticate_user!

      # Every user other than the current one, whether or not they have shared
      # anything yet.
      def users
        owners = User.where.not(id: current_user.id).order(Arel.sql("COALESCE(name, email)"))
        render json: { users: owners.map { |owner| owner_json(owner) } }
      end

      # A user's public folders and files, scoped to a public parent folder
      # (or the root). Only public items are ever exposed.
      def entries
        owner = User.find_by(id: params[:user_id])
        return render json: { error: "User not found." }, status: :not_found if owner.nil?

        parent = nil
        if params[:parent_id].present?
          parent = owner.folders.public_folders.find_by(id: params[:parent_id])
          return render json: { error: "Folder not found." }, status: :not_found if parent.nil?
        end

        folders = owner.folders.public_folders.where(parent_id: parent&.id).order(:name)
        documents = owner.documents.public_documents.kept.where(folder_id: parent&.id).order(:name)

        render json: {
          owner: owner_json(owner),
          folders: folders.map { |folder| folder_json(folder) },
          documents: documents.map { |document| document_json(document) }
        }
      end

      # Streams any user's public file, so shared listings can offer downloads.
      def download_document
        document = Document.public_documents.kept.find_by(id: params[:id])
        if document.nil? || !document.file.attached?
          return render json: { error: "File not found." }, status: :not_found
        end

        send_data document.file.download,
          filename: document.name,
          type: document.content_type.presence || "application/octet-stream",
          disposition: "attachment"
      end

      # Downloads a public folder as a ZIP, including only the public files and
      # subfolders that a viewer is allowed to see.
      def download_folder
        folder = Folder.public_folders.find_by(id: params[:id])
        return render json: { error: "Folder not found." }, status: :not_found if folder.nil?

        buffer = Zip::OutputStream.write_buffer do |zip|
          add_public_folder_to_archive(zip, folder, "#{folder.name}/")
        end
        send_data buffer.string,
          filename: "#{folder.name}.zip",
          type: "application/zip",
          disposition: "attachment"
      end

      private

      def add_public_folder_to_archive(zip, folder, prefix)
        zip.put_next_entry(prefix)

        folder.documents.public_documents.kept.order(:name).find_each do |document|
          next unless document.file.attached?

          zip.put_next_entry("#{prefix}#{document.name}")
          zip.write(document.file.download)
        end

        folder.children.public_folders.order(:name).find_each do |child|
          add_public_folder_to_archive(zip, child, "#{prefix}#{child.name}/")
        end
      end

      def owner_json(owner)
        { id: owner.id, name: owner.name, email: owner.email }
      end

      def folder_json(folder)
        { id: folder.id, name: folder.name, parent_id: folder.parent_id, is_public: folder.is_public }
      end

      def document_json(document)
        {
          id: document.id,
          name: document.name,
          content_type: document.content_type,
          byte_size: document.byte_size,
          folder_id: document.folder_id,
          is_public: document.is_public
        }
      end
    end
  end
end
