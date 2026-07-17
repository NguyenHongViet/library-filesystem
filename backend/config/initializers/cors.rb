# Allow the SPA to call the API. Set FRONTEND_ORIGIN (comma-separated) to override.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(ENV.fetch("FRONTEND_ORIGIN", "http://localhost:5173").split(","))

    resource "*",
      headers: :any,
      expose: %w[Authorization],
      credentials: true,
      methods: %i[get post put patch delete options head]
  end
end
