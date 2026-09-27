# City Hospital — Hospital Management System

A full-stack Hospital Management System built with **AngularJS 1.8 (frontend) + Node.js/Express (backend) + PostgreSQL (database)**.

The Excel file you provided (`Hospital_Dataset_100_Diverse_RealTimeReady.xlsx`) is used **only as a one-time seed source**. Once seeded, the application reads and writes exclusively to PostgreSQL — Excel is never touched again at runtime.

---

## 1. Architecture

```
Browser (AngularJS 1.8)
     |  HTTP + JWT Bearer token
     v
Express REST API  (Node.js)
     |  parameterized SQL, transactions
     v
PostgreSQL  (single source of truth)
```

**Why this stack:**
- **PostgreSQL** over MySQL: native `SEQUENCE` objects + `SELECT ... FOR UPDATE` row locking, which is exactly what safe, restart-proof ID generation and race-free bed allocation need.
- **No ORM**: raw parameterized SQL (`pg` library) so you can see and learn exactly what's happening — critical for the MCA coursework angle.
- **AngularJS 1.8**: as requested. Routing via `ngRoute`, all data comes from `$http` calls to the API — no static/mock data anywhere.
- **JWT + bcrypt**: stateless auth, industry standard for this scale of app.
- **Chart.js**: all chart data comes from backend SQL aggregation endpoints (`/api/dashboard/charts/*`, `/api/analytics/*`) — nothing is hardcoded.

---

## 2. Folder Structure

```
hms/
├── backend/
│   ├── src/
│   │   ├── config/db.js          # PostgreSQL pool + transaction helper
│   │   ├── middleware/           # auth (JWT), errorHandler
│   │   ├── utils/                # idGenerator (sequences), audit logging
│   │   ├── routes/                # one file per resource (12 route files)
│   │   ├── app.js                # Express app wiring
│   │   └── server.js             # entrypoint
│   ├── migrations/001_init.sql   # full relational schema
│   ├── scripts/
│   │   ├── migrate.js            # runs the schema
│   │   └── seed.js               # imports Excel, idempotent
│   ├── data/seed.xlsx            # your original Excel (seed source only)
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── index.html
    ├── css/style.css
    ├── js/
    │   ├── app.js                 # module, routes, auth interceptor
    │   ├── services/              # ApiService, AuthService, ToastService
    │   └── controllers/           # one per module
    └── partials/                  # one HTML view per module
```

---

## 3. Prerequisites

- Node.js 18+
- PostgreSQL 13+ running locally (or a connection string to a hosted instance)
- npm

---

## 4. Setup Instructions

### Step 1 — Create the database
```bash
psql -U postgres
CREATE DATABASE hms_db;
CREATE USER hms_user WITH ENCRYPTED PASSWORD 'change_this_password';
GRANT ALL PRIVILEGES ON DATABASE hms_db TO hms_user;
\q
```

### Step 2 — Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set PGUSER/PGPASSWORD to match what you created above,
# set JWT_SECRET to a long random string, and set your desired
# DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD (this becomes your real login).

npm run migrate   # creates all 12 tables, indexes, constraints, sequences
npm run seed       # imports the 100 patients + all reference data from Excel (idempotent)

npm run dev        # starts the API on http://localhost:5000
```

You should see:
```
Connected to PostgreSQL successfully.
HMS backend listening on http://localhost:5000
```

### Step 3 — Frontend
The frontend is static — no build step. Just serve it:
```bash
cd frontend
npx serve .          # or: python3 -m http.server 8080
```
Open the served URL (e.g. `http://localhost:8080`). If your backend runs on a different host/port, update `API_BASE_URL` in `frontend/js/app.js`.

### Step 4 — Log in
Use the email/password you set as `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` in `.env`. This is a real bcrypt-hashed account created by the seed script — not a hardcoded credential.

> **Note on the Excel's `admins` sheet:** it contains synthetic placeholder password hashes that aren't real bcrypt hashes of any usable password, so the seed script deliberately does not import them as login credentials. Instead it creates one real admin account from your `.env` values. You can create additional admins later by inserting into the `admins` table with a real `bcrypt.hash()` value, or by adding an admin-management endpoint.

---

## 5. Verifying the Critical Requirements Yourself

I could not run these against a live database inside this sandbox (no network access to a DB server here), so please run through this checklist on your machine:

1. `npm run seed` → confirm console prints "Patients: 100 rows processed" and "Next patient ID will be: PAT-2026-000101".
2. Log in with your seeded admin.
3. Go to **Patients → Register Patient**, fill the form, submit. Confirm the returned/shown ID is `PAT-2026-000101`.
4. Register a second patient → confirm `PAT-2026-000102`.
5. Refresh the browser → data persists (it's in Postgres, not memory).
6. Stop and restart the backend (`Ctrl+C`, `npm run dev` again) → register another patient → confirm it's `PAT-2026-000103` (sequence survived restart).
7. Run `npm run seed` again → confirm no duplicate rows are created (check `SELECT COUNT(*) FROM patients;` stays the same).
8. **OPD/Visits** → create a visit for a patient.
9. **Admissions** → admit that patient to a ward/bed → confirm in **Wards & Beds** that the bed now shows `OCCUPIED`.
10. **Daily Reports** → add a report for that admission → try adding a second report for the *same admission and same date* → confirm you get a clean "already exists" error, not a duplicate row.
11. **Discharges** → discharge that admission → confirm the bed flips back to `AVAILABLE` and the patient's status becomes `DISCHARGED`.
12. **Dashboard** → confirm the KPI numbers and charts reflect these actions immediately (they're live SQL aggregations, not cached/static).
13. **Audit Logs** → confirm entries exist for your login, the patient registration, the admission, and the discharge.
14. **Appointments** → try double-booking the same doctor at the same date/time → confirm it's rejected.

---

## 6. Security Notes

- Passwords hashed with bcrypt (cost factor 12).
- JWT tokens expire (`JWT_EXPIRES_IN`, default 8h); the frontend auto-logs-out on a 401.
- Login is rate-limited (5 attempts / 15 min by default) and accounts lock temporarily after repeated failures.
- All SQL uses parameterized queries — no string concatenation, no injection surface.
- `helmet` sets secure HTTP headers; CORS is configured (tighten `CORS_ORIGIN` in `.env` for production instead of `*`).
- `.env` is git-ignored; never commit real credentials.
- Never expose `PGPASSWORD`/`JWT_SECRET` to the frontend — they only ever live server-side.

---

## 7. Known Gaps / Suggested Next Features

Being transparent about what's deliberately out of scope for this first pass:
- No admin-management UI (creating/editing other admin accounts) — currently DB-only.
- No file/document uploads (lab reports, scans) — could add an `attachments` table + S3/local storage.
- No email/SMS notifications for appointments.
- No role-based permission granularity beyond `SUPER_ADMIN` / `ADMIN` (the schema supports adding more granular roles later).
- No automated test suite (unit/integration tests) — recommended next step before production use.
- Consider adding database backups/replication and a proper reverse proxy (nginx) + HTTPS in front of the Node app for production deployment.

---

## 8. Dependencies Summary

**Backend:** express, pg, bcrypt, jsonwebtoken, express-validator, express-rate-limit, helmet, cors, morgan, dotenv, xlsx (seed only), nodemon (dev).

**Frontend:** AngularJS 1.8.3, angular-route, Bootstrap 5, Font Awesome 6, Chart.js 4 — all loaded via CDN, zero build tooling required.
