# BillFlow — Multi-Company Billing & Quotation Management

A professional, modern web application for running **billing (invoicing)** and **quotation** operations across **any number of companies** from a single login. Built to replace the `NAGARAJ_BILL.xlsx` spreadsheet workflow while preserving every field and adding the things a spreadsheet can't do: atomic numbering, derived totals, per-company GST, branded PDFs, dashboards, and reports.

> **This build is a runnable, client-side application.** All data is persisted in the browser (localStorage) behind a single, swappable data layer (`src/lib/db.ts`). When you're ready for a real backend (PostgreSQL + Prisma per the original spec), only that one file needs to change — the relational schema and all business logic already live in `src/lib`.

---

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL (default http://localhost:5173).

### Demo logins

| Role | Email | Password |
|---|---|---|
| Admin | `admin@billflow.app` | `admin123` |
| Operator | `operator@billflow.app` | `operator123` |

The app **seeds itself** on first run with the two existing companies (**Print Technology** — GST registered, **Shravan Infotech** — non-GST), a few customers, and sample bills/quotations so the dashboard and reports aren't empty. Reset anytime from **Settings → Reset to demo data**.

### Build for production

```bash
npm run build      # type-checks then bundles to dist/
npm run preview    # serve the production build locally
```

Deploy `dist/` to any static host. Because it's a single-page app the host must **fall back to `index.html`** for unknown routes — `vercel.json` already does this for Vercel.

---

## Deploy to GitHub + Vercel (step by step)

### A. Put the project on GitHub

1. **Install Git** (if needed): https://git-scm.com/download/win — accept defaults, then reopen your terminal.
2. **Create a GitHub account / sign in**: https://github.com
3. In the project folder (`D:\Print_Technology`), initialise and commit:
   ```bash
   git init
   git add .
   git commit -m "BillFlow: billing & quotation app"
   ```
   (`node_modules` and `dist` are already ignored via `.gitignore`.)
4. **Create an empty repo** on GitHub: click **New repository**, name it e.g. `billflow`, leave it empty (no README/.gitignore), click **Create**.
5. **Connect and push** (copy the URL GitHub shows, then):
   ```bash
   git branch -M main
   git remote add origin https://github.com/<your-username>/billflow.git
   git push -u origin main
   ```
   If prompted to sign in, use the browser pop-up (or a Personal Access Token as the password).

### B. Deploy on Vercel

1. Go to https://vercel.com and **Sign up with GitHub** (authorise access).
2. Click **Add New… → Project**, then **Import** your `billflow` repo.
3. Vercel auto-detects **Vite**. Confirm the settings (they should already match):
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Click **Deploy**. In ~1 minute you get a live URL like `https://billflow-xxxx.vercel.app`.
5. **Every future `git push` to `main` auto-deploys.** To update the live site:
   ```bash
   git add .
   git commit -m "describe your change"
   git push
   ```

### C. Optional: your own domain
In Vercel → your project → **Settings → Domains → Add**, then point your domain's DNS as Vercel instructs.

> **Important — where the data lives.** This build stores data in **each browser's localStorage**, so data does **not** sync between devices or users, and clearing the browser wipes it. That's fine for a single-operator setup on one machine. For shared, multi-device access you'll want the real backend (the whole app already talks to one data seam, `src/lib/db.ts`, so swapping in a hosted database + API is a contained change). Always keep periodic **Settings → Export full backup** files.

---

## What's included (all five phases)

**Phase 1 — Foundation:** email/password auth with Admin/Operator roles, **Admin user management** (create/edit/delete multiple users, Users page), company & customer management, seeded with the two existing companies (each with its own generated logo).

**Phase 2 — Billing:** single-form create/edit with a spreadsheet-like line-item editor (Enter adds a row), live gross/discount/tax/net/balance, payment capture with partial payments and history, draft vs. finalized, atomic per-company + global numbering, list with filters/sort/bulk export, detail view with PDF/Excel/print/duplicate/delete.

**Phase 3 — Quotations:** the same experience minus payments, plus `valid_until`, quote status (Draft/Sent/Accepted/Rejected/Expired), and **one-click Convert-to-Bill**.

**Phase 4 — Dashboard & Reports:** KPI cards, revenue-over-time and outstanding-by-age charts, pending-bills widget with aging buckets (0–30/31–60/61–90/90+), recent activity, company comparison (consolidated). Reports: Sales register, Receivables, Payments, Quotations (with conversion rate), Customer statement (running balance), Company/consolidated summary, and a GST working summary — **all exportable to Excel**.

**Phase 5 — Polish:** per-company GST driven by GSTIN presence, configurable tax rates & FY start, **distinct per-company document designs** (three templates — Modern / Classic / Minimal — each with its own colours, layout and font), **colourful-yet-B&W-printer-friendly** invoices (`print-color-adjust: exact`, meaning carried by contrast/borders/weight not colour alone), a **With header / Letter-pad toggle** so documents can print on your pre-printed letterhead, mobile-responsive tables→cards, keyboard-friendly forms, Indian rupee grouping (₹1,50,000.00) and amount-in-words, full-backup export.

**Design controls:** each company (in **Companies → Edit**) chooses its template, font, primary + secondary accent, and logo — so a **new** company gets its own look with no code. Standalone logo files are in `public/logo-*.svg`.

---

## Key business rules (as specified)

- **Money is derived, never hand-typed.** Gross/taxable/tax/net/balance are computed from line items + discount; payment status is derived from balance. See `src/lib/calc.ts`.
- **Two numbering series.** A global `Bill_No` unique system-wide, plus a per-company, per-financial-year `Company_Bill_No` (e.g. `PT/2025-26/014`) that prints on the invoice. Assigned atomically on finalize. See `src/lib/numbering.ts`.
- **GST is per company.** A company with a GSTIN issues a **"Tax Invoice"** with HSN/SAC, per-line GST, and CGST+SGST (intra-state) or IGST (inter-state, detected from state codes). A company without a GSTIN issues a plain **"Invoice"** with no tax. Nothing is hard-coded — rates/HSN/FY are configurable in **Settings**.
- **Customer snapshots.** Name/address/phone/GSTIN are copied onto each document so editing a customer later never changes historical invoices.
- **Add a company with zero code changes** via **Companies → Add Company** (branding, GSTIN, prefixes, bank/UPI, accent, logo).

> **GST statutory note.** Tax-invoice content follows CGST Rule 46 (as amended up to 2025, CBIC). Rates, HSN-digit requirements, and e-invoicing thresholds change periodically — confirm the exact configuration against current CBIC notifications and each company's registration before go-live. The GST report is an internal working figure, **not** a filed return.

---

## PDF & Excel exports

- **Invoices/quotes → PDF:** click **PDF / Print** on any document and choose "Save as PDF". The layout is a print-ready A4 sheet (`@page` A4, print stylesheet in `src/index.css`) branded per company. No server or headless browser required.
- **Invoices/quotes → Excel** and **every report → Excel** via SheetJS, with headers, ₹ number formats, totals rows, a filter summary, and one-sheet-per-company on consolidated exports. See `src/lib/excel.ts`.
- **Full backup:** Settings → Export full backup (Excel) so you're never locked in.

---

## Project structure

```
src/
  lib/
    types.ts       Domain model (Excel headers preserved in comments)
    db.ts          Persistence seam + seed data  ← swap this for a real API
    store.tsx      React context: all state + mutations (auth, CRUD, payments, convert)
    calc.ts        Derived money engine (gross/tax/net/balance/status)
    numbering.ts   Global + per-company/FY numbering
    format.ts      ₹ grouping, amount-in-words, dates, Excel-serial conversion
    excel.ts       SheetJS exports (documents, registers, reports, backup)
  components/
    Layout.tsx        Sidebar, top bar, company switcher, global search
    LineItemEditor.tsx, CustomerFields.tsx, DocumentView.tsx (A4 invoice), ui.tsx
  pages/
    Login, Dashboard, Bills, BillForm, BillDetail,
    Quotations, QuoteForm, QuoteDetail, Customers, Companies, Reports, Settings
```

## Tech stack

React 18 + TypeScript, Vite, Tailwind CSS, React Router, Recharts, SheetJS (xlsx), lucide-react.

---

## Migrating the real `NAGARAJ_BILL.xlsx`

The data layer already models every workbook entity (`companies`, `customers`, `bills`+`bill_items`, `quotations`+`quotation_items`) with the original column names preserved. `src/lib/format.ts` includes `excelSerialToISO()` for converting Excel date serials (base 1899-12-30). To import your real workbook, read each sheet (e.g. with SheetJS), map rows into the seed shape in `src/lib/db.ts`, recompute totals via `calc.ts` (don't trust legacy hand-entered totals), and backfill any missing `Company_Bill_No` via `numbering.ts`. The staging sheets (`Billing_Description`, `Bill`, `Quote`) are intentionally ignored.
```
