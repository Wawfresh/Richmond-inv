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

> **Deploying via GitHub Actions**:
> - Pushing to `main` triggers `.github/workflows/ci.yml`, which builds `deploy-dist/` and attaches `richmond-inv-namecheap-package` as a downloadable artifact in **GitHub → Actions**.
> - To push straight from GitHub to Namecheap over FTPS, add repository secrets `NAMECHEAP_FTP_SERVER`, `NAMECHEAP_FTP_USERNAME`, and `NAMECHEAP_FTP_PASSWORD`, then run **Actions → Deploy to Namecheap → Run workflow** (`.github/workflows/deploy-namecheap.yml`). Afterward, open **cPanel → Setup Node.js App** and click **Run NPM Install** (whenever `package.json` changes) and **Restart**.

---

## 3. Configure MySQL/MariaDB in Namecheap cPanel

1. Open **cPanel → MySQL® Databases**.
2. Create a database (example: `cpaneluser_richmond_inv`).
3. Create a database user with a strong password and assign **ALL PRIVILEGES** to that database.
4. Keep the database host as `localhost` (port `3306`).

---

## 4. Deploy in cPanel (Setup Node.js App — Recommended Single-Root Mode)

Mounting **Setup Node.js App** at your domain root (`/`) with `SERVE_STATIC="true"` is the cleanest setup on Namecheap Stellar because Passenger preserves full `/api/*` paths and Express serves both the API and the React frontend (`dist/`).

1. Open **cPanel → Domains** and enable **Force HTTPS Redirect** for your domain.
2. In **cPanel → File Manager**, confirm `/home/<cpanel_user>/richmond-inv-app/` exists outside `public_html/`.
3. Upload the contents of `deploy-dist/richmond-inv-app-single-root/` (`server.js`, `package.json`, `dist/`, `storage/`) into `/home/<cpanel_user>/richmond-inv-app/` (or run the **Deploy to Namecheap** GitHub Action).
4. Create `/home/<cpanel_user>/richmond-inv-app/.env` (permissions `0600`) using `.env.example`:

```env
NODE_ENV="production"
PORT="3000"
APP_URL="https://yourdomain.com"
CORS_ORIGIN="https://yourdomain.com"
SERVE_STATIC="true"

DB_CLIENT="mysql2"
DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="cpaneluser_richmond_inv"
DB_USER="cpaneluser_richmond_user"
DB_PASSWORD="YOUR_STRONG_MYSQL_PASSWORD"
DB_POOL_MAX="8"

SESSION_SECRET="GENERATE_64_CHAR_HEX_RANDOM_SECRET"
COOKIE_SECURE="true"
COOKIE_SAMESITE="lax"
UPLOAD_STORAGE_DIR="/home/<cpanel_user>/richmond-inv-app/storage/private_uploads"

INITIAL_ADMIN_EMAIL="admin@yourdomain.com"
INITIAL_ADMIN_PASSWORD="CHANGE_IMMEDIATELY_STRONG_PASSWORD"
```

5. Open **cPanel → Setup Node.js App** and click **Create Application**:
   - **Node.js version**: `22.x` (or `20.x`)
   - **Application mode**: `Production`
   - **Application root**: `richmond-inv-app`
   - **Application URL**: `yourdomain.com` (leave the path field empty)
   - **Application startup file**: `server.js`
6. Click **Run NPM Install** in the cPanel Node.js interface (installs pure-JS runtime dependencies cleanly within shared hosting memory limits).
7. Click **Start App** (or **Restart**). On startup, `server.js` automatically runs versioned Knex migrations (`001` through `006`) against Namecheap MySQL/MariaDB and initializes roles, permissions, CMS pages, and the initial Administrator account.

---

## 5. Optional: Separate Apache `public_html/` Mode

Only use `deploy-dist/public_html/` + `deploy/public_html.htaccess` if you are configuring an external reverse proxy that forwards `/api/*` **without** stripping the `/api` prefix (set `SERVE_STATIC="false"` in `.env`). For standard Namecheap Stellar shared hosting, keep the single-root setup in Section 4.

---

## 6. Post-Deployment Verification Checklist

1. Confirm `https://yourdomain.com/api/health` returns `{"ok":true,"service":"RICHMOND-INV"}`.
2. Confirm `https://yourdomain.com` loads cleanly and refreshes on client routes like `/offerings` and `/portal` without 404 errors.
3. Confirm `https://yourdomain.com/api/public/project-overview.pdf` downloads the Project Overview PDF.
4. Sign in at `https://yourdomain.com/admin/login` using `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`, then immediately rotate the admin password.
5. Configure live crypto treasury wallets, auto/manual settlement mode, and SMTP settings in the Administrator Portal.
6. Confirm `/home/<cpanel_user>/richmond-inv-app/.env` and `storage/private_uploads/` are outside `public_html/` and unreachable via browser URL.
