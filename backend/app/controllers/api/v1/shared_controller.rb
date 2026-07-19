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

      # Searches a single user's shared content by name. Admins may opt in to
      # searching private items too. Location is not returned so private
      # ancestor folder names are never leaked.
      def search
        owner = User.find_by(id: params[:user_id])
        return render json: { error: "User not found." }, status: :not_found if owner.nil?

        query = params[:q].to_s.strip
        return render json: { folders: [], documents: [] } if query.blank?

        pattern = "%#{ActiveRecord::Base.sanitize_sql_like(query)}%"
        folders = folder_scope(owner).where("name ILIKE ?", pattern).order(:name).limit(100)
        documents = document_scope(owner).where("name ILIKE ?", pattern).order(:name).limit(100)

        render json: {
          folders: folders.map { |folder| folder_json(folder) },
          documents: documents.map { |document| document_json(document) }
        }
      end

      # A user's shared folders and files, scoped to a parent folder (or the
      # root). Only public items are exposed unless an admin opts in to private.
      def entries
        owner = User.find_by(id: params[:user_id])
        return render json: { error: "User not found." }, status: :not_found if owner.nil?

        parent = nil
        if params[:parent_id].present?
          parent = folder_scope(owner).find_by(id: params[:parent_id])
          return render json: { error: "Folder not found." }, status: :not_found if parent.nil?
        end

        folders = folder_scope(owner).where(parent_id: parent&.id).order(:name)
        documents = document_scope(owner).where(folder_id: parent&.id).order(:name)

        render json: {
          owner: owner_json(owner),
          folders: folders.map { |folder| folder_json(folder) },
          documents: documents.map { |document| document_json(document) }
        }
      end

      # Streams a shared file (public, or private for an opted-in admin).
      def download_document
        document = document_download_scope.find_by(id: params[:id])
        if document.nil? || !document.file.attached?
          return render json: { error: "File not found." }, status: :not_found
        end

        send_data document.file.download,
          filename: document.name,
          type: document.content_type.presence || "application/octet-stream",
          disposition: "attachment"
      end

      # Downloads a shared folder as a ZIP, including the files and subfolders a
      # viewer is allowed to see (public only, or everything for an admin).
      def download_folder
        folder = folder_download_scope.find_by(id: params[:id])
        return render json: { error: "Folder not found." }, status: :not_found if folder.nil?

        include_private = include_private?
        buffer = Zip::OutputStream.write_buffer do |zip|
          add_folder_to_archive(zip, folder, "#{folder.name}/", include_private)
        end
        send_data buffer.string,
          filename: "#{folder.name}.zip",
          type: "application/zip",
          disposition: "attachment"
      end

      # Copies a shared file into the current user's library, under a chosen
      # destination folder (blank folder_id = root).
      def copy_document
        source = document_download_scope.find_by(id: params[:id])
        return render json: { error: "File not found." }, status: :not_found if source.nil?

        destination = destination_folder
        return if performed?

        copy = ActiveRecord::Base.transaction { source.copy_to!(owner: current_user, folder: destination) }
        render json: { document: copied_json(copy) }, status: :created
      end

      # Copies a shared folder (its subtree) into the current user's library.
      def copy_folder
        source = folder_download_scope.find_by(id: params[:id])
        return render json: { error: "Folder not found." }, status: :not_found if source.nil?

        destination = destination_folder
        return if performed?

        copy = ActiveRecord::Base.transaction do
          source.copy_to!(owner: current_user, parent: destination, include_private: include_private?)
        end
        render json: { folder: { id: copy.id, name: copy.name, parent_id: copy.parent_id } }, status: :created
      end

      private

      # Admins can opt in to seeing private content by passing include_private.
      def include_private?
        current_user.admin? && ActiveModel::Type::Boolean.new.cast(params[:include_private])
      end

      def folder_scope(owner)
        include_private? ? owner.folders : owner.folders.public_folders
      end

      def document_scope(owner)
        base = include_private? ? owner.documents : owner.documents.public_documents
        base.kept
      end

      def document_download_scope
        base = include_private? ? Document : Document.public_documents
        base.kept
      end

      def folder_download_scope
        include_private? ? Folder : Folder.public_folders
      end

      # Resolves the current user's destination folder from folder_id. Returns
      # nil for the root; renders 404 (and marks the response performed) when a
      # given folder is missing or not owned by the user.
      def destination_folder
        return nil if params[:folder_id].blank?

        current_user.folders.find(params[:folder_id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Destination folder not found." }, status: :not_found
        nil
      end

      def copied_json(document)
        {
          id: document.id,
          name: document.name,
          folder_id: document.folder_id,
          copied_from_id: document.copied_from_id
        }
      end

      def add_folder_to_archive(zip, folder, prefix, include_private)
        zip.put_next_entry(prefix)

        documents = include_private ? folder.documents.kept : folder.documents.public_documents.kept
        documents.order(:name).find_each do |document|
          next unless document.file.attached?

          zip.put_next_entry("#{prefix}#{document.name}")
          zip.write(document.file.download)
        end

        children = include_private ? folder.children : folder.children.public_folders
        children.order(:name).find_each do |child|
          add_folder_to_archive(zip, child, "#{prefix}#{child.name}/", include_private)
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
