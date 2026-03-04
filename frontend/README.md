# Smart Document Generator (IDEA Institute)

This repository contains the frontend and backend for the Smart Document
Generator application.  The frontend is a React/Vite single‑page app that
allows administrators to log in, upload DOCX templates, and generate
certificates, letters, circulars and notices.  The Flask/Python backend
handles templating, PDF conversion and stores metadata in MongoDB Atlas.

---

## 📁 Repository structure

```
backend/         # Flask API and utility modules
frontend/        # React + Vite UI
templates/       # version‑controlled DOCX templates (default)
``` 

## 🧠 Backend highlights

* Python 3.10, Flask, PyMongo (MongoDB Atlas free tier)
* JWT authentication with 24‑h tokens and bcrypt password hashing
* Two‑tier template system:
  * `default_templates/` – shipped with the repo
  * `user_templates/` – runtime uploads via `/upload-template`
* Database collections: `users`, `certificates`, `notices`
* Bulk certificate generator uses `ThreadPoolExecutor` to process rows in
  parallel (8 workers) for sub‑second generation of 100 certificates.

## 📦 Dependencies & environment

Backend requirements are in `backend/requirements.txt`.  Key packages:

```
Flask
pymongo
docxtpl
python-dotenv
reportlab
openpyxl
```

`python -m pip install -r requirements.txt` in a virtualenv.

### MongoDB Atlas

* Create a free cluster and obtain the `MONGO_URI` connection string.
* Set `DB_NAME` (default is `documents_db`).
* Add your frontend origin to `CORS_ORIGINS` if running separately.

Example `.env` (see `.env.example`):

```env
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net
DB_NAME=documents_db
JWT_SECRET_KEY=your_secret
CORS_ORIGINS=http://localhost:5173
``` 

## 🖨️ PDF conversion & LibreOffice

The backend initially converted `.docx` files to PDF via LibreOffice
command‑line (`soffice`).  On Windows this points to
`C:\Program Files\LibreOffice\program\soffice.exe`; on Unix it expects
`soffice` on the `PATH`.

**Render and other Linux hosts do _not_ include LibreOffice by default.**
An attempt to call it will raise a `RuntimeError` (or crash Flask with
`FileNotFoundError`).

To handle this gracefully we now:

1. Detect the operating system and choose the right executable path.
2. Catch `FileNotFoundError` and `CalledProcessError` and log a warning.
3. Fall back to a lightweight pure‑Python converter (using `python-docx`
   and `reportlab`) that streams paragraphs into the PDF.  The output is
   text‑only but keeps the service working without installing LibreOffice.

For best visual fidelity you can still install LibreOffice in your
container or use a custom buildpack.  Otherwise the fallback ensures the
app never fails due to missing binaries.

## 🚀 Running locally

1. Start MongoDB (or use Atlas).
2. `cd backend && python -m venv .venv && .venv\Scripts\activate` (Windows)
   or `source .venv/bin/activate` (Unix).
3. Install dependencies and set up `.env`.
4. `python app.py` to launch the API.
5. In another shell `cd frontend && npm install && npm run dev`.

## 🏁 Deployment tips

* Use Render, Heroku, or any provider that supports Python 3.10 and
  environment variables.
* If you require full DOCX→PDF fidelity, ensure LibreOffice is
  installed in the runtime image (e.g. via `apt-get install libreoffice`
  in a Dockerfile).
* Free MongoDB Atlas cluster works with no cost; just configure IP
  whitelist and connection string.

---

Feel free to explore the code—comments and helper functions are in
`backend/utils/`.  Happy document‑generating!
