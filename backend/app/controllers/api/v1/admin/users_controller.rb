module Api
  module V1
    module Admin
      class UsersController < ApplicationController
        before_action :authenticate_user!
        before_action :require_admin!

        def index
          users = User.order(:email)
          render json: { users: users.map { |user| admin_user_json(user) } }
        end

        def create
          user = User.new(create_params)

          if user.save
            render json: { user: admin_user_json(user) }, status: :created
          else
            render json: { errors: user.errors.full_messages }, status: :unprocessable_content
          end
        end

        def update
          user = User.find(params[:id])

          if user.update(update_params)
            render json: { user: admin_user_json(user) }
          else
            render json: { errors: user.errors.full_messages }, status: :unprocessable_content
          end
        rescue ActiveRecord::RecordNotFound
          render json: { error: "User not found." }, status: :not_found
        end

        def destroy
          user = User.find(params[:id])

          if user == current_user
            return render json: { errors: [ "You cannot delete your own account." ] }, status: :unprocessable_content
          end

          user.destroy
          head :no_content
        rescue ActiveRecord::RecordNotFound
          render json: { error: "User not found." }, status: :not_found
        end

        private

        def create_params
          params.permit(:email, :name, :role, :password)
        end

        # Password is only changed when a new one is provided.
        def update_params
          permitted = params.permit(:email, :name, :role, :password)
          permitted.delete(:password) if permitted[:password].blank?
          permitted
        end

        def admin_user_json(user)
          {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            created_at: user.created_at.iso8601
          }
        end
      end
    end
  end
end
