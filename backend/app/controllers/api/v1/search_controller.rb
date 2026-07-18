module Api
  module V1
    class SearchController < ApplicationController
      before_action :authenticate_user!

      RESULT_LIMIT = 100

      # Searches the current user's whole library by folder/file name.
      def index
        query = params[:q].to_s.strip
        return render json: { folders: [], documents: [] } if query.blank?

        pattern = "%#{ActiveRecord::Base.sanitize_sql_like(query)}%"
        folders = current_user.folders.where("name ILIKE ?", pattern).order(:name).limit(RESULT_LIMIT)
        documents = current_user.documents.kept.where("name ILIKE ?", pattern).order(:name).limit(RESULT_LIMIT)

        render json: {
          folders: folders.map { |folder| folder_json(folder) },
          documents: documents.map { |document| document_json(document) }
        }
      end

      private

      def folder_json(folder)
        {
          id: folder.id,
          name: folder.name,
          parent_id: folder.parent_id,
          location: folder.parent&.path
        }
      end

      def document_json(document)
        {
          id: document.id,
          name: document.name,
          content_type: document.content_type,
          byte_size: document.byte_size,
          folder_id: document.folder_id,
          location: document.folder&.path
        }
      end
    end
  end
end
