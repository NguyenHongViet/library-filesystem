module Api
  module V1
    class FoldersController < ApplicationController
      before_action :authenticate_user!

      def index
        folders = current_user.folders.where(parent_id: params[:parent_id].presence).order(:name)
        render json: { folders: folders.map { |folder| folder_json(folder) } }
      end

      def show
        folder = current_user.folders.find(params[:id])
        render json: {
          folder: folder_json(folder),
          breadcrumb: folder.self_and_ancestors.map { |f| folder_json(f) }
        }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Folder not found." }, status: :not_found
      end

      def update
        folder = current_user.folders.find(params[:id])

        if folder.update(is_public: ActiveModel::Type::Boolean.new.cast(params[:is_public]))
          render json: { folder: folder_json(folder) }
        else
          render json: { errors: folder.errors.full_messages }, status: :unprocessable_content
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Folder not found." }, status: :not_found
      end

      def create
        parent_id = nil
        if params[:parent_id].present?
          parent = current_user.folders.find_by(id: params[:parent_id])
          return render json: { error: "Folder not found." }, status: :not_found if parent.nil?

          parent_id = parent.id
        end

        folder = current_user.folders.new(name: params[:name], parent_id: parent_id)

        if folder.save
          render json: { folder: folder_json(folder) }, status: :created
        else
          render json: { errors: folder.errors.full_messages }, status: :unprocessable_content
        end
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
