# Features.md – KeySafe Tracker Backend

## Overview

This document describes the **backend features** for KeySafe Tracker – a Node.js + Express + PostgreSQL system that receives location reports from phone‑based PWA scanners, stores them, and serves data to the frontend dashboard. All features are exposed via RESTful API endpoints, protected by JWT authentication.

---

## Core Features

### 1. User Authentication & Authorisation

- **Register new users** (open registration or admin‑only – configurable). Default role: `staff`.
- **Login** with email/password → returns JWT (expires in 7 days).
- **JWT validation** on all protected endpoints.
- **Role‑based access control**:
  - `admin`: full system access (CRUD keys, users, configuration, view all logs).
  - `staff`: can view keys, submit reports, view history, manage own profile.
  - `security`: read‑only access to maps and logs (optional, can be same as staff).
- **Change password** for authenticated user.
- **Admin actions on users**: create, edit role, delete, reset password.

### 2. Report Ingestion (from Phone Scans)

- **Endpoint:** `POST /api/reports`
- **Accepts:** BLE key ID, GPS coordinates (lat/lng), RSSI (dBm).
- **Validation:** 
  - Key ID must exist in `keys` table (or optionally auto‑create? No – only registered keys).
  - RSSI must be between -100 and -30.
  - Coordinates must be valid.
- **RSSI filtering:** Reports with RSSI weaker than a configurable threshold (default -85 dBm) are **ignored** (no database write, but returns 200 to save phone battery). This prevents false positives.
- **Processing:**
  - Update `keys` table with new `latitude`, `longitude`, `last_updated` = now.
  - Insert a new record into `tracking_logs` with `gateway_id = 'phone_' + user_id`.
  - If key status was `lost` and RSSI is strong (e.g., > -60), optionally auto‑set status to `available` (configurable).
- **Response:** `200 OK` always (even if ignored) to avoid retries. Optional debug mode for testing.

### 3. Key Management

- **List all keys** (`GET /api/keys`) – returns array of key objects with current location, status, holder name.
- **Get single key** (`GET /api/keys/:keyId`).
- **Create new key** (`POST /api/keys`) – admin only.
  - Required fields: `keyId` (BLE UUID), `keyName`, `category`.
  - Optional: `currentHolderId`, initial `status`.
- **Update key** (`PUT /api/keys/:keyId`) – admin only.
  - Can change name, category, status, holder assignment.
- **Delete key** (`DELETE /api/keys/:keyId`) – admin only (cascades to logs? Keep logs but set key_id NULL or cascade delete? Better to cascade delete logs to maintain referential integrity – decide).
- **Key status values:** `available`, `checked_out`, `lost`. Frontend uses these for colour coding.

### 4. Tracking Logs (Audit Trail)

- **Retrieve logs for a specific key** (`GET /api/tracking-logs?keyId=:keyId`) – returns chronological list.
- **Global logs** (admin only) – `GET /api/tracking-logs` with filters:
  - `startDate` / `endDate` (ISO timestamps)
  - `userId` (reporting user)
  - `keyId`
  - Pagination: `limit` (default 20), `offset` (default 0)
- **Response includes:** log ID, key name, gateway ID, reporting user name, coordinates, RSSI, timestamp.
- **Export CSV** – not an API feature but frontend can generate CSV from fetched logs. Backend could provide a `Accept: text/csv` header if needed, but optional.

### 5. User Management (Admin Only)

- **List all users** (`GET /api/users`) – returns `user_id`, `full_name`, `email`, `role`, `created_at`.
- **Create user** (`POST /api/users`) – requires email, full name, role, temporary password (hashed).
- **Update user** (`PUT /api/users/:userId`) – change name, email, role.
- **Delete user** (`DELETE /api/users/:userId`) – soft delete? Hard delete for simplicity.
- **Reset password** (`POST /api/users/:userId/reset-password`) – generates a random temporary password, returns it (or sends email – optional).

### 6. System Configuration (Admin Only)

- **Get RSSI threshold** (`GET /api/config/rssi-threshold`) – returns current value.
- **Update RSSI threshold** (`PUT /api/config/rssi-threshold`) – stores in `app_config` table or environment. Using database table allows runtime changes without restart.
- **Optional:** Staleness threshold (for frontend) – can be stored similarly but frontend currently decides.

### 7. Current User Profile

- **Get profile** (`GET /api/user/me`) – returns user object (without password hash).
- **Change password** (`PUT /api/user/me/password`) – requires old password and new password.

---

## Database Features (PostgreSQL)

### Tables

- **`users`** – authentication and roles.
- **`keys`** – key inventory with current location.
- **`tracking_logs`** – immutable history of all reports.
- **`app_config`** – key‑value store for runtime configuration.

### Indexes for Performance

- `tracking_logs(key_id, timestamp)` – for fast history retrieval.
- `tracking_logs(timestamp)` – for time‑range queries.
- `keys(last_updated)` – for staleness checks (though frontend handles).
- `users(email)` – for login lookup.

### Data Integrity

- Foreign key `tracking_logs.key_id` references `keys.key_id` with `ON DELETE CASCADE`.
+- `keys.current_holder_id` references `users.user_id` with `ON DELETE SET NULL`.
+- `keys.latitude` / `longitude` allow null (no location yet).

### Automatic Timestamps

- `users.created_at` – set on insert.
- `keys.last_updated` – updated on every report.
- `tracking_logs.timestamp` – default to `CURRENT_TIMESTAMP`.

---

## Security Features

- **Password hashing** – bcrypt (salt rounds = 10).
- **JWT** – signed with secret, includes `userId` and `role`. Expiry 7 days.
- **HTTPS enforcement** – in production, the deployment platform provides HTTPS. Backend should set secure flags if behind proxy.
- **CORS** – restrict to known frontend origins (configurable via env).
- **Input validation** – all request bodies and query params validated (express‑validator or Joi).
- **Rate limiting** – optional but recommended: limit report submissions per user per minute (e.g., 60 requests/min) to prevent abuse.

---

## API Features Summary

| Feature Area | Endpoints | Auth Required | Role Restriction |
|--------------|-----------|---------------|------------------|
| Authentication | `/api/auth/login`, `/api/auth/register` | No (register may be open or admin) | – |
| Profile | `/api/user/me`, `/api/user/me/password` | Yes | None (own profile) |
| Reports | `POST /api/reports` | Yes | staff or admin |
| Keys (read) | `GET /api/keys`, `/api/keys/:keyId` | Yes | staff+ |
| Keys (write) | `POST/PUT/DELETE /api/keys` | Yes | admin only |
| Tracking logs (by key) | `GET /api/tracking-logs?keyId=...` | Yes | staff+ |
| Tracking logs (global) | `GET /api/tracking-logs` | Yes | admin only |
| Users management | `GET/POST/PUT/DELETE /api/users`, reset‑password | Yes | admin only |
| Configuration | `GET/PUT /api/config/rssi-threshold` | Yes | admin only |

---

## Non‑Functional Features

### Performance

- **Response time** – <200ms for typical requests (excluding large log queries).
- **Pagination** – required for logs and user lists to avoid large payloads.
- **Connection pooling** – use `pg.Pool` to reuse database connections.

### Scalability

- Stateless server – can be scaled horizontally behind a load balancer.
- Database can be upgraded (indexes, read replicas) if needed.

### Logging & Monitoring

- HTTP request logging (morgan).
- Error logging (winston) – write to file or stdout.
- Health check endpoint `GET /health` – returns `{ status: "ok" }` for uptime monitoring.

### Documentation

- Optional: Swagger / OpenAPI specification at `/api-docs` for easy frontend integration.

### Environment Configuration

- All secrets and tunable parameters via environment variables:
  - Database credentials
  - JWT secret
  - Port
  - RSSI threshold default
  - CORS allowed origins

---

## Development & Testing Features

- **Seed script** – populates database with admin user, sample keys, and mock logs.
- **Database migrations** – using Prisma or `node-pg-migrate` for version control.
- **Unit tests** – for password hashing, RSSI filtering logic, validation.
- **Integration tests** – for API endpoints (using supertest).

---

## Future / Optional Features

- **Real‑time notifications** – Socket.io or SSE to push new reports to frontend without polling.
- **Email notifications** – when a lost key is detected.
- **Webhook support** – call external URLs when a key is seen.
- **Geofencing** – trigger alerts when a key enters/leaves a defined area.
- **Automatic status change** – based on frequency of reports (e.g., if no report for 24h, mark as lost).

---

This backend feature set fully supports the phone‑only KeySafe Tracker system as defined in the frontend `Features.md` and `AGENT.md`.