module Api
  module V1
    class HealthController < ApplicationController
      def ping
        render json: {
          status: "ok",
          service: "library-filesystem-api",
          time: Time.current.iso8601,
          rails_env: Rails.env
        }
      end
    end
  end
end
