module Api
  module V1
    class SessionsController < ApplicationController
      before_action :authenticate_user!, only: :show

      def create
        user = User.find_for_database_authentication(email: login_params[:email])

        if user&.valid_password?(login_params[:password])
          sign_in(user)
          render json: { user: user_json(user) }, status: :ok
        else
          render json: { error: "Invalid email or password." }, status: :unauthorized
        end
      end

      def destroy
        sign_out(current_user)
        head :no_content
      end

      def show
        render json: { user: user_json(current_user) }, status: :ok
      end

      private

      def login_params
        params.require(:user).permit(:email, :password)
      end
    end
  end
end
