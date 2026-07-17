Rails.application.routes.draw do
  # The SPA authenticates through the JSON endpoints below, so Devise's default
  # HTML routes are skipped while keeping the :user mapping and helpers.
  devise_for :users, skip: :all

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      get "ping" => "health#ping"

      post "login" => "sessions#create"
      delete "logout" => "sessions#destroy"
      get "me" => "sessions#show"

      resources :documents, only: [ :index, :create, :update ]
      resources :folders, only: [ :index, :show, :create ]
    end
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
