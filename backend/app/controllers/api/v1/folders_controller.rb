module Api
  module V1
    class FoldersController < ApplicationController
      before_action :authenticate_user!

      def index
        folders = current_user.folders.where(parent_id: params[:parent_id].presence).order(:name)
        render json: { folders: folders.map { |folder| folder_json(folder) } }
      end

      private

      def folder_json(folder)
        {
          id: folder.id,
          name: folder.name,
          is_public: folder.is_public,
          parent_id: folder.parent_id,
          created_at: folder.created_at.iso8601,
          updated_at: folder.updated_at.iso8601
        }
      end
    end
  end
end
