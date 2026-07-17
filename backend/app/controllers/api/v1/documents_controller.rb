module Api
  module V1
    class DocumentsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_folder

      def index
        documents = current_user.documents.kept.where(folder: @folder).order(:name)
        render json: { documents: documents.map { |document| document_json(document) } }
      end

      def show
        document = current_user.documents.kept.find(params[:id])
        render json: { document: document_detail_json(document), versions: versions_json(document) }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Document not found." }, status: :not_found
      end

      def restore_version
        document = current_user.documents.kept.find(params[:id])
        version = document.document_versions.find(params[:version_id])
        document.restore_version!(version, user: current_user)
        render json: { document: document_detail_json(document), versions: versions_json(document) }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Document or version not found." }, status: :not_found
      end

      def download
        document = current_user.documents.kept.find(params[:id])
        send_attached(document.file, filename: document.name, content_type: document.content_type)
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Document not found." }, status: :not_found
      end

      def download_version
        document = current_user.documents.kept.find(params[:id])
        version = document.document_versions.find(params[:version_id])
        send_attached(
          version.file,
          filename: "v#{version.version_number}-#{document.name}",
          content_type: version.content_type
        )
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Document or version not found." }, status: :not_found
      end

      def update
        document = current_user.documents.kept.find(params[:id])

        attributes = {}
        attributes[:folder] = @folder if params.key?(:folder_id)
        if params.key?(:is_public)
          attributes[:is_public] = ActiveModel::Type::Boolean.new.cast(params[:is_public])
        end

        if document.update(attributes)
          render json: { document: document_json(document) }
        else
          render json: { errors: document.errors.full_messages }, status: :unprocessable_content
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Document not found." }, status: :not_found
      end

      def create
        uploaded = params[:file]
        return render json: { errors: [ "File is required." ] }, status: :unprocessable_content if uploaded.blank?

        name = params[:name].presence || uploaded.original_filename
        existing = current_user.documents.kept.find_by(name: name, folder_id: @folder&.id)

        # Re-uploading a file with the same name in the same folder overwrites it
        # and keeps the previous contents as an older version.
        if existing
          changed = existing.overwrite_with!(uploaded, user: current_user)
          return render json: { document: document_json(existing), unchanged: !changed }
        end

        document = current_user.documents.new(
          name: name,
          folder: @folder,
          content_type: uploaded.content_type,
          byte_size: uploaded.size
        )
        document.file.attach(uploaded)

        if document.save
          render json: { document: document_json(document) }, status: :created
        else
          render json: { errors: document.errors.full_messages }, status: :unprocessable_content
        end
      end

      def destroy
        document = current_user.documents.kept.find(params[:id])
        document.soft_delete!
        head :no_content
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Document not found." }, status: :not_found
      end

      def restore
        document = current_user.documents.trashed.find(params[:id])
        document.restore!
        render json: { document: document_json(document) }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Document not found." }, status: :not_found
      end

      private

      def send_attached(attachment, filename:, content_type:)
        return render json: { error: "File not found." }, status: :not_found unless attachment.attached?

        send_data attachment.download,
          filename: filename,
          type: content_type.presence || "application/octet-stream",
          disposition: "attachment"
      end

      # A blank folder_id means the user's root folder.
      def set_folder
        return if params[:folder_id].blank?

        @folder = current_user.folders.find(params[:folder_id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Folder not found." }, status: :not_found
      end

      def document_json(document)
        {
          id: document.id,
          name: document.name,
          content_type: document.content_type,
          byte_size: document.byte_size,
          is_public: document.is_public,
          folder_id: document.folder_id,
          deleted_at: document.deleted_at&.iso8601,
          deleted_path: document.deleted_path,
          created_at: document.created_at.iso8601,
          updated_at: document.updated_at.iso8601
        }
      end

      # Adds the folder path (nil at the root) for the file detail view.
      def document_detail_json(document)
        document_json(document).merge(location: document.folder&.path)
      end

      def versions_json(document)
        document.document_versions.order(version_number: :desc).map do |version|
          {
            id: version.id,
            version_number: version.version_number,
            content_type: version.content_type,
            byte_size: version.byte_size,
            created_at: version.created_at.iso8601
          }
        end
      end
    end
  end
end
