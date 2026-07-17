module Api
  module V1
    class DocumentsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_folder

      def index
        documents = current_user.documents.where(folder: @folder).order(:name)
        render json: { documents: documents.map { |document| document_json(document) } }
      end

      def update
        document = current_user.documents.find(params[:id])

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

        document = current_user.documents.new(
          name: params[:name].presence || uploaded.original_filename,
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

      private

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
          created_at: document.created_at.iso8601,
          updated_at: document.updated_at.iso8601
        }
      end
    end
  end
end
