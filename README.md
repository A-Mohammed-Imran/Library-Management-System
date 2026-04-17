# Library Management System (Netlify Frontend + Flask API)

This project is split into two deployable parts:

- Frontend: Static HTML, CSS, and JavaScript (`frontend/`) for Netlify
- Backend: Flask REST API with SQLite (`backend/`) for Render or Railway

## Features

- Home dashboard with statistics
- Add book
- View all books in table format
- Search by title
- Issue book
- Return book
- Delete book
- Success and error messages
- Mobile-friendly responsive UI

## Project Structure

```
Library Management System/
|-- backend/
|   |-- app.py
|   |-- requirements.txt
|   |-- library.db (auto-created)
|-- frontend/
|   |-- index.html
|   |-- styles.css
|   |-- app.js
|   |-- config.js
|-- netlify.toml
|-- render.yaml
|-- README.md
|-- app.py (old template-based version)
|-- templates/ (old template-based version)
|-- static/ (old template-based version)
|-- library_management_system.py (old console version)
```

## API Endpoints

- `GET /api/health`
- `GET /api/stats`
- `GET /api/books`
- `GET /api/books?query=...`
- `GET /api/books/<id>`
- `POST /api/books`
- `PATCH /api/books/<id>/issue`
- `PATCH /api/books/<id>/return`
- `DELETE /api/books/<id>`

## Run Locally

### 1. Run Backend (Flask API)

1. Open terminal in `backend/`.
2. Create and activate virtual environment.
3. Install dependencies.
4. Start API server.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Backend runs at:

```
http://127.0.0.1:5000/api
```

### 2. Run Frontend

Open a second terminal in `frontend/` and serve static files:

```bash
cd frontend
python -m http.server 5500
```

Open:

```
http://127.0.0.1:5500
```

In the UI, keep API URL as:

```
http://127.0.0.1:5000/api
```

## Deploy Backend to Render

1. Push your project to GitHub.
2. In Render, create a new Web Service from your repo.
3. Set Root Directory to `backend`.
4. Build Command:

```bash
pip install -r requirements.txt
```

5. Start Command:

```bash
gunicorn app:app
```

6. Add environment variable:

- `CORS_ORIGINS` = your Netlify site URL (or `*` during testing)

After deployment, your backend URL will be like:

```
https://your-backend.onrender.com/api
```

## Deploy Frontend to Netlify

1. In Netlify, create a new site from GitHub.
2. Select this repository.
3. Netlify uses `netlify.toml`:

- Base directory: `frontend`
- Publish directory: `.`

4. Deploy.
5. Open the deployed site.
6. In the "Backend API URL" field, enter your Render API URL:

```
https://your-backend.onrender.com/api
```

7. Click "Save URL".

The frontend stores this URL in browser local storage and uses it for all requests.

## Railway Option (Backend)

You can deploy `backend/` to Railway with the same commands:

- Install: `pip install -r requirements.txt`
- Start: `gunicorn app:app`

Set `CORS_ORIGINS` to your Netlify domain.