# RICHMOND-INV

Enterprise Investment Management, Share Offering, and Investor Relations Platform built with **React 19**, **Vite**, **Tailwind CSS**, **Express**, and **Knex.js** (SQLite locally, MySQL2/MariaDB in production).

---

## Key Capabilities

- **Public Institutional Website**: Editorial investor relations portal, published investment plans, announcements, FAQ knowledge base, contact desk, and downloadable Project Overview PDF (`/api/public/project-overview.pdf`).
- **Investor Portal (`/portal`)**:
  - Account registration, session authentication, CSRF protection, and password recovery.
  - Editable investor profile (`telephone`, address, and KYC details; registered email remains locked).
  - KYC compliance submission & private document upload (`kyc_documents`).
  - Investment order flow constrained strictly to offering **Min / Max** limits, routing directly to `/portal/pay/:requestId`.
  - Cryptocurrency settlement portal supporting **Automatic** and **Manual** processing modes, blockchain TXID submission, and payment proof uploads.
  - Dedicated **Withdraw Funds** view in the investor sidebar (`/portal/withdraw`).
  - Portfolio valuation, dividend history, CSV export, and **PDF Portfolio Statement** generation (`pdfkit`).
- **Administrator Portal (`/admin/login`, `/admin`)**:
  - Real-time platform liquidity summary (starts at `$0.00` net balance with one-click balance clearing that preserves user accounts).
  - Investor management (create, edit, inspect, **Access Dashboard** delegated sessions, and per-investor balance clearing).
  - Share offering / investment plan management, KYC compliance review, crypto wallet & auto/manual processor configuration, withdrawal review queue (`/admin/withdrawals`), dividend declaration/distribution, CMS editing, and audit logs.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7 |
| Backend | Node.js (>=20 LTS), Express, Helmet, Rate Limiting, Multer, PDFKit |
| Database | Knex.js (`better-sqlite3` for local dev, `mysql2` for Namecheap / production) |
| Bundling | `vite build` (frontend `dist/`) + `esbuild` (single-file ESM `server.js`) |

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional locally; SQLite fallback is automatic)
cp .env.example .env

# 3. Start full-stack dev server on http://localhost:3000
npm run dev
```

On first startup with an empty database, migrations (`001` through `006`) run automatically and initialize roles, permissions, CMS pages, crypto payment methods, baseline offerings, and the bootstrap administrator account.

---

## Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts Express + Vite dev middleware on port `3000` |
| `npm run lint` | Runs `tsc --noEmit` TypeScript verification |
| `npm run build` | Builds frontend (`dist/`) and bundles backend (`server.js`) |
| `npm run package:namecheap` | Builds and assembles clean Namecheap upload folders under `deploy-dist/` |
| `npm run start` | Runs production server (`NODE_ENV=production node server.js`) |
| `npm run clean` | Removes `dist/`, `deploy-dist/`, and `server.js` |

---

## GitHub Setup & CI

The repository includes:
- `.gitignore` excluding `node_modules/`, `dist/`, `deploy-dist/`, `server.js`, `storage/`, `*.sqlite*`, `.env*`, and logs.
- `.github/workflows/ci.yml` running `npm install`, `npm run lint`, and `npm run build` on pushes and pull requests to `main` / `master`.

```bash
git init
git add .
git commit -m "chore: prepare RICHMOND-INV for GitHub and Namecheap deployment"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

---

## Namecheap Deployment

Full step-by-step instructions for **Namecheap Stellar** (cPanel MySQL + Setup Node.js App + Apache `public_html`) are documented in [`DEPLOYMENT_NAMECHEAP_STELLAR.md`](./DEPLOYMENT_NAMECHEAP_STELLAR.md).

Quick packaging command:

```bash
npm run package:namecheap
```
