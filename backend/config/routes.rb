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

      resources :documents, only: [ :index, :show, :create, :update, :destroy ] do
        member do
          get :download
          post :restore
          post "versions/:version_id/restore", action: :restore_version
          get "versions/:version_id/download", action: :download_version
        end
      end
      resources :folders, only: [ :index, :show, :create, :update, :destroy ] do
        member { get :download }
        collection { get :download_root }
      end
      get "trash" => "trash#index"
      get "search" => "search#index"
      get "shared/users" => "shared#users"
      get "shared/users/:user_id/entries" => "shared#entries"
      get "shared/users/:user_id/search" => "shared#search"
      get "shared/documents/:id/download" => "shared#download_document"
      get "shared/folders/:id/download" => "shared#download_folder"
      post "shared/documents/:id/copy" => "shared#copy_document"
      post "shared/folders/:id/copy" => "shared#copy_folder"
    end
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
