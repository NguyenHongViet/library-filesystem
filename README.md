# library-filesystem

A simple way for users to access files on the system, as well as upload their own files for storage and share.

Architecture:

- **backend/** — Rails 8 (API mode) + PostgreSQL
- **frontend/** — React 19 + Vite (SPA)
- **docker-compose.yml** — bundles `db` (Postgres), `backend`, `frontend` for the dev environment

## Features

### Authentication & accounts

- Session/cookie authentication via Devise (`login` / `logout` / `me`).
- Two roles: **member** and **admin**.

### My files

- Browse folders with a breadcrumb; click a folder to open it. The list shows
  each item's **name, size and upload date**.
- Create folders (nested supported).
- Upload **multiple files** and **whole folders** (structure preserved) via the
  Upload buttons or drag-and-drop. A mix of files and folders can be dropped at
  once. An upload **progress bar** shows how many items are done.
- Re-uploading a file with the same name in the same location **overwrites** it
  and keeps the previous contents as an older **version** (up to the 5 most
  recent versions). Identical content is detected by **checksum** and skipped so
  no redundant version is stored.
- **Move** files into folders by drag-and-drop.
- Files and folders are **public (visible to everyone) by default** — the
  library is collaborative — and each one has a switch to make it **private**
  (hidden from other users). Existing items keep their current visibility.
- **Delete**: files are soft-deleted (sent to Trash); deleting a folder removes
  it but moves its files to the Trash, remembering their original path.
- **Download** a single file, or a folder / the whole library as a **ZIP**
  (folder structure preserved).
- **File detail page** (open by clicking a file): shows location, type, size,
  and the **version history** with restore + download for each version, plus
  download of the current file.
- **Search** files and folders by name across the whole library (results show
  each item's location).

### Trash

- List of deleted files with their original location and deletion date.
- **Restore** a file — its folder path is recreated if it no longer exists.
- A scheduled job permanently deletes files that have been in the Trash for more
  than **30 days** (runs daily via Solid Queue).

### Shared files

- Browse the list of users, then browse a selected user's **public** folders and
  files (with breadcrumb).
- **Download** a shared file, or a shared folder as a ZIP.
- **Copy** a shared file or folder into your own library (folders keep their
  structure; copies are fresh files with no version history; name collisions are
  auto-renamed, e.g. `report (1).txt`).
- **Search** a single user's shared content by name.
- **Admin only:** a checkbox reveals **private** files and folders too, and lets
  the admin browse / search / download / copy them.

### Account & user management

- **Any user** has an **Account** page to **change their own password** and to
  **leave** (permanently delete their own account and all their files).
- **Admin only:** a **Manage users** page (linked next to Sign out) with full
  CRUD: list, create, edit (name, email, role, password), and delete users.
- Passwords are only changed on edit when a new one is provided; an admin cannot
  delete their own account from the admin page.

## Requirements

Only **Docker** and **Docker Compose**. No need to install Ruby/Node on your machine.

## Quick start

```bash
cp .env.example .env      # first time
docker compose up --build
```

Once running:

| Service  | URL                               |
| -------- | --------------------------------- |
| Frontend | http://localhost:5173             |
| Backend  | http://localhost:3000             |
| API ping | http://localhost:3000/api/v1/ping |
| Health   | http://localhost:3000/up          |
| Postgres | localhost:5432                    |

Open the frontend at http://localhost:5173 and you will be asked to sign in.

## Authentication

Authentication is handled by [Devise](https://github.com/heartcombo/devise). The
Rails API is session/cookie based: the SPA calls the JSON endpoints below and the
session cookie is carried automatically through the Vite dev proxy.

| Method   | Endpoint         | Purpose                       |
| -------- | ---------------- | ----------------------------- |
| `POST`   | `/api/v1/login`  | Sign in (`{ user: { email, password } }`) |
| `DELETE` | `/api/v1/logout` | Sign out                      |
| `GET`    | `/api/v1/me`     | Current user (401 if not signed in) |

### Seed users

Run the seeds to create demo accounts (already run automatically on `db:setup`):

```bash
docker compose exec backend bin/rails db:seed
```

All demo accounts share the password **`password123`**:

| Email               | Password      | Role   |
| ------------------- | ------------- | ------ |
| `admin@example.com` | `password123` | admin  |
| `alice@example.com` | `password123` | member |
| `bob@example.com`   | `password123` | member |
| `carol@example.com` | `password123` | member |
| `dave@example.com`  | `password123` | member |

> These credentials are for local development only. Do not use them in production.

## Common commands

```bash
docker compose up                 # run (already built)
docker compose up --build         # rebuild then run
docker compose up -d              # run in the background
docker compose logs -f backend    # follow logs for one service
docker compose down               # stop & remove containers
docker compose down -v            # stop & remove volumes too (drops DB data)
```

Run commands inside a container:

```bash
# Rails
docker compose exec backend bin/rails console
docker compose exec backend bin/rails db:migrate
docker compose exec backend bin/rails generate model Document name:string

# Frontend
docker compose exec frontend npm install <package>
```

## Testing

```bash
# Backend (RSpec + SimpleCov -> backend/coverage/index.html)
docker compose exec backend bundle exec rspec

# Frontend (Vitest + React Testing Library)
docker compose exec frontend npm test          # watch mode
docker compose exec frontend npm run coverage   # single run + coverage
```

## How the connection works

- The frontend calls the API using relative paths `/api/...`.
- The Vite dev server **proxies** `/api` to `http://backend:3000` (see `frontend/vite.config.js`) to avoid CORS in dev.
- The backend still enables `rack-cors` (`backend/config/initializers/cors.rb`) for direct calls; the origin is configured via `FRONTEND_ORIGIN`.
- The DB connection is configured via environment variables in `backend/config/database.yml` (default host `db`).

## Production notes

- `backend/Dockerfile` (generated by Rails, multi-stage) is for production; `Dockerfile.dev` is for development only.
- A production build for the frontend is still needed (`vite build` → serve static files, e.g. via Nginx) for a real deployment.
