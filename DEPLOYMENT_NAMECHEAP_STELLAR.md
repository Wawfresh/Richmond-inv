# RICHMOND-INV — Namecheap Stellar Shared Hosting Deployment Guide

This guide covers deploying **RICHMOND-INV** cleanly to **Namecheap Stellar** shared hosting using **cPanel MySQL/MariaDB**, **Setup Node.js App (Node 20/22 LTS)**, and **Apache `public_html/`**.

---

## 1. Hosting Architecture Overview

- **Public Web Root (`public_html/`)**: Serves only the compiled static React frontend (`dist/` + `.htaccess`). Zero TypeScript source files, `.env` secrets, or uploaded KYC/payment documents live in `public_html/`.
- **Private Application Root (`/home/<cpanel_user>/richmond-inv-app/`)**: Holds `server.js`, trimmed runtime `package.json`, `node_modules/`, `.env`, and `storage/private_uploads/` outside `public_html/`.
- **Database**: Namecheap cPanel MySQL/MariaDB (`mysql2` + Knex.js), running migrations `001` through `006` automatically on first boot.

---

## 2. Build & Package Locally (or Download CI Artifacts)

Run the packager script from your local machine before uploading to Namecheap:

```bash
npm install
npm run lint
npm run package:namecheap
```

This generates clean upload-ready folders in `deploy-dist/`:

1. `deploy-dist/public_html/` — Static React bundle (`index.html`, `assets/`, `RICHMOND-INV-Project-Overview.pdf`) **plus `.htaccess`** (copied from `deploy/public_html.htaccess`).
2. `deploy-dist/richmond-inv-app/` — Runtime-only Node.js server folder (`server.js`, slim `package.json` with zero native C++/`better-sqlite3` build dependencies, `.env.example`, and `storage/private_uploads/`).
3. `deploy-dist/richmond-inv-app-single-root/` — Alternative single-folder deployment if you mount the Node.js App directly at `/` (`SERVE_STATIC=true`) instead of using `public_html/`.

---

## 3. Configure MySQL/MariaDB in Namecheap cPanel

1. Open **cPanel → MySQL® Databases**.
2. Create a database (example: `cpaneluser_richmond_inv`).
3. Create a database user with a strong password and assign **ALL PRIVILEGES** to that database.
4. Keep the database host as `localhost` (port `3306`).

---

## 4. Deploy the Node.js Backend (`richmond-inv-app`)

1. In **cPanel → File Manager**, create `/home/<cpanel_user>/richmond-inv-app/` **outside** `public_html/`.
2. Upload the contents of `deploy-dist/richmond-inv-app/` (`server.js`, `package.json`, `storage/`) into `/home/<cpanel_user>/richmond-inv-app/`.
3. Create `/home/<cpanel_user>/richmond-inv-app/.env` (set permissions to `0600`) based on `.env.example`:

```env
NODE_ENV="production"
PORT="3000"
APP_URL="https://yourdomain.com"
CORS_ORIGIN="https://yourdomain.com"
SERVE_STATIC="false"

DB_CLIENT="mysql2"
DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="cpaneluser_richmond_inv"
DB_USER="cpaneluser_richmond_user"
DB_PASSWORD="YOUR_STRONG_MYSQL_PASSWORD"
DB_POOL_MAX="8"

SESSION_SECRET="REPLACE_WITH_64_BYTE_RANDOM_HEX"
COOKIE_SECURE="true"
COOKIE_SAMESITE="lax"

UPLOAD_STORAGE_DIR="/home/<cpanel_user>/richmond-inv-app/storage/private_uploads"

INITIAL_ADMIN_EMAIL="admin@yourdomain.com"
INITIAL_ADMIN_PASSWORD="REPLACE_WITH_STRONG_ADMIN_PASSWORD"
```

4. Open **cPanel → Setup Node.js App** and click **Create Application**:
   - **Node.js version**: `22.x` (or `20.x`)
   - **Application mode**: `Production`
   - **Application root**: `richmond-inv-app`
   - **Application URL**: `yourdomain.com/api`
   - **Application startup file**: `server.js`
5. Click **Run NPM Install** inside the cPanel Node.js App screen (installs only pure-JS runtime dependencies cleanly within shared hosting memory limits).
6. Click **Start App** (or **Restart**). Migrations `001`–`006` and initial seed records will run automatically against your MySQL database.

---

## 5. Deploy the Static Frontend (`public_html/`)

1. Open `/home/<cpanel_user>/public_html/` in **cPanel → File Manager**.
2. Upload the contents of `deploy-dist/public_html/` (make sure **Show Hidden Files** is enabled so `.htaccess` is visible and uploaded).
3. Verify `public_html/.htaccess` contains the rules from `deploy/public_html.htaccess` (HTTPS redirect, `/api` passthrough to Passenger, dotfile blocking, and React Router `/index.html` fallback).

> **Alternative Single-Root Mode**: If you prefer cPanel Node.js App mounted at `yourdomain.com/` directly, upload `deploy-dist/richmond-inv-app-single-root/` instead, set `SERVE_STATIC="true"` in `.env`, and do not place React files in `public_html/`.

---

## 6. Post-Deployment Verification Checklist

1. Confirm `https://yourdomain.com/api/health` returns `{"ok":true,"service":"RICHMOND-INV"}`.
2. Confirm `https://yourdomain.com` loads cleanly and refreshes on client routes like `/offerings` and `/portal` without 404 errors.
3. Confirm `https://yourdomain.com/api/public/project-overview.pdf` downloads the Project Overview PDF.
4. Sign in at `https://yourdomain.com/admin/login` using `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`, then immediately rotate the admin password.
5. Configure live crypto treasury wallets, auto/manual settlement mode, and SMTP settings in the Administrator Portal.
6. Confirm `/home/<cpanel_user>/richmond-inv-app/.env` and `storage/private_uploads/` are outside `public_html/` and unreachable via browser URL.
