class ApplicationController < ActionController::API
  def authenticate_user!
    return if user_signed_in?

    render json: { error: "You need to sign in before continuing." }, status: :unauthorized
  end

  def require_admin!
    return if current_user&.admin?

    render json: { error: "Admin access is required." }, status: :forbidden
  end

  def user_json(user)
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  end
end
