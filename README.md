# Enterprise Meeting Minutes — Vercel + Firebase

## Local Dev (same as production)
- Install Vercel CLI: `npm i -g vercel`
- Create `.env.local` in project root (copy from `.env.example` and fill real values):
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_SERVICE_ACCOUNT_JSON` (full JSON in one line)
  - `SESSION_SECRET`
  - `SESSION_COOKIE_SECURE=true`
  - optional `ADMIN_USER`, `ADMIN_PASSWORD`, `SECRETARY_USER`, `SECRETARY_PASSWORD`
- Run: `vercel dev`
- Open: `http://localhost:3000/login.html`

## Environment Notes
- Cookies: `HttpOnly`, `SameSite=None`, `Secure` on HTTPS
- Auth endpoints:
  - `GET /api/check-auth`
  - `POST /api/login`
  - `POST /api/logout`
- Meetings:
  - `GET /api/meetings`
  - `POST /api/meetings`
  - `GET /api/meetings/:id`
  - `PUT /api/meetings/:id`
- Health:
  - `GET /api/healthz` → `{"status":"ok"}`

## Production Deploy
- Vercel → Project Settings → Environment Variables
  - Set values from `.env.example` (use real project/service account)
- Deploy and open your domain
- Clear browser storage if needed:
  - Remove `API_BASE` from Local Storage
  - Clear cookies for the domain

## Defaults
- Chairman: `admin` / `admin123`
- Secretary: `user` / `user123`

