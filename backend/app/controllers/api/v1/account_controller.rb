module Api
  module V1
    class AccountController < ApplicationController
      before_action :authenticate_user!

      # Lets the signed-in user change their own password, verifying the current
      # one first.
      def update_password
        if current_user.update_with_password(password_params)
          # The password digest changed, so refresh the session to stay signed in.
          bypass_sign_in(current_user)
          render json: { user: user_json(current_user) }
        else
          render json: { errors: current_user.errors.full_messages }, status: :unprocessable_content
        end
      end

      # Lets the signed-in user delete (leave) their own account.
      def destroy
        user = current_user
        sign_out(user)
        user.destroy
        head :no_content
      end

      private

      def password_params
        params.permit(:current_password, :password)
      end
    end
  end
end
