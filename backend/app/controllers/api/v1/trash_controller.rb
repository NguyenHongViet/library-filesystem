module Api
  module V1
    class TrashController < ApplicationController
      before_action :authenticate_user!

      def index
        documents = current_user.documents.trashed.order(deleted_at: :desc)
        render json: { documents: documents.map { |document| document_json(document) } }
      end

      private

      def document_json(document)
        {
          id: document.id,
          name: document.name,
          content_type: document.content_type,
          byte_size: document.byte_size,
          is_public: document.is_public,
          folder_id: document.folder_id,
          deleted_at: document.deleted_at&.iso8601,
          deleted_path: document.deleted_path
        }
      end
    end
  end
end
