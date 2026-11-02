# Dealer Ledger

A ledger app for a mobile distribution business. The field team (workers) records each
dealer's **sales, sale returns, payments (cash or bank) and scheme amounts**. The admin
sees everything and controls who can see older data.

Built with the MERN stack: MongoDB, Express, React (Vite) and Node. It installs as a **PWA**,
so the same app works in a browser and as an "app" on Android, iPhone or desktop.

## Features

| Area | What it does |
|---|---|
| **Admin login** | Fixed username + password set in `server/.env` (created automatically on first start). The admin stays logged in for 7 days. **Fingerprint login:** in Profile, choose "Add this device", then use "Log in with fingerprint" on the login screen. This uses WebAuthn passkeys, which are free and built into Android, iPhone and Windows. |
| **Worker login** | Username + password, then the admin must **approve** it (Logins page, refreshes on its own). The approval lasts until **midnight that day**, and the next day needs a new approval. The admin can "Log out now" a worker at any time. Logging out or deactivating a worker ends the session on the server. |
| **Dealers** | Shop name, route and opening balance only. All workers share all dealers. **Workers can add** dealers, but **only the admin can edit or delete** them. Each dealer has a ledger with a running balance. Only the admin sees balances in the dealer list; workers see a balance after opening the dealer. |
| **Routes** | A dropdown with Siyana, Aurangabad, BB Nagar, Garh, Simbhawli, Khanpur, Bugrasi and Jahangirabad, plus "+ Add new route", which saves the route to the shared list. |
| **Entries** | Sale, sale return, payment (**Cash** or **Bank**) and scheme, each as an amount. Workers can enter **today or yesterday**. The admin can enter any date. Worker home has 4 big buttons; the **Today** tab shows today's totals, entries and cash closing. |
| **Worker data limit** | A worker sees only the **last 30 days**, enforced on the server. To see older data, they request it for **one dealer** and a date range. Once the admin approves (for N days), that range becomes visible. |
| **Edit lock** | Workers can only edit their own entries on the same day they entered them. After the admin verifies that day's cash closing, those entries lock. |
| **Soft delete** | Nothing is ever permanently deleted. Everything is recorded in the audit log. |
| **Daily cash closing** | Covers the payments the worker *entered* today (including yesterday-dated ones). The worker declares the cash, and the admin verifies or disputes it. If a payment is added **after** verification, the closing **re-opens automatically**: the admin is notified and the worker submits again. The admin can't verify a closing whose totals changed after it was submitted. |
| **Phone notifications (admin)** | Free Web Push. The admin's phone gets **"Ravi wants to log in. Tap to approve."** even when the app is closed, and tapping it opens the Logins page. The admin also gets alerts for old-data requests and cash closings. To turn it on: Profile → **Enable notifications** (once on each phone or computer). On iPhone, use "Add to Home Screen" first (iOS 16.4+). |
| **Reports (admin)** | Sales summary, worker-wise, dealer outstanding, cash vs. bank, scheme payout and returns, each exportable to Excel and PDF. On phones each row shows as a card. |

Everything is free: no SMS, email, WhatsApp or paid APIs. MongoDB Atlas (free tier) and Render or Vercel (free tier) are enough to host it.

## Run locally

Prerequisites: Node 20+ and MongoDB (local, or a free MongoDB Atlas cluster).

```bash
# 1. Backend
cd server
cp .env.example .env          # set MONGO_URI, JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
npm install
npm run dev                   # http://localhost:5000 (creates admin + default routes)

# 2. Frontend (new terminal)
cd client
npm install
npm run dev                   # http://localhost:5173
```

To reset the admin password: `npm run create-admin -- --username admin --password NEWPASS`

## Deploy

**Option A: one server (simplest).** `cd client && npm run build`, then `cd ../server && NODE_ENV=production npm start`.
The server also serves the built app. Host it on Render (free) and use MongoDB Atlas (free).

**Option B: separate hosting.** Client on Vercel or Netlify (`VITE_API_URL=https://api.example.com/api`), server on Render (`CLIENT_URL=https://app.example.com`).

**Fingerprint login and the "Install app" prompt both need HTTPS.** Every host above provides it. In production, set
`RP_ID` to the app's domain (e.g. `ledger.onrender.com`) and `RP_ORIGIN` to its full URL (`https://ledger.onrender.com`).

## Configuration (`server/.env`)

| Variable | Meaning |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `CLIENT_URL` | Allowed frontend origin(s), comma-separated |
| `WORKER_VISIBLE_DAYS` | Days a worker can see without approval (default 30) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME` | The fixed admin account |
| `RP_ID` / `RP_ORIGIN` | Domain and URL used for fingerprint login |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Optional. Push-notification keys are generated automatically on first start and saved in the database. |

## Project layout

```
server/src
  models/         User, Customer, Route, Transaction, LoginRequest, Passkey, AccessRequest, CashClosing, AuditLog
  services/       access.js (worker visibility rules), ledger.js, reports.js, exporter.js, audit.js
  routes/         auth (+fingerprint), login-requests, users, customers (+routes), transactions, access-requests, cash-closings, reports, audit
client/src
  pages/          Login, LoginApprovals, Dashboard, WorkerHome, Customers, CustomerDetail, Entries, Requests, CashClosing, Reports, Workers, AuditLog
  components/     Layout (nav), TxnForm, CustomerForm, RequestForm, ui.jsx
```

All dates are business dates in India time (IST).
