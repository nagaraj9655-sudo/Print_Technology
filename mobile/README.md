# Magizhini — Android app (Expo / React Native)

A native Android app for the Magizhini billing & quotations platform, sharing the
same Supabase cloud database as the web app. Everything you do here syncs with the
web app in real time.

## Features (parity with the web app)

- **Supabase auth** — sign in with your existing account; sessions persist.
- **Multi-company** — switch the active company (or "All companies") from any header.
- **Dashboard** — billed / received / outstanding KPIs, aging buckets, pending bills, reminders-due.
- **Bills** — create / edit / finalize, GST (CGST-SGST vs IGST), per-line HSN/SAC & tax,
  per-document GST toggle, discounts (₹ or %), handbill (manual book) bills, cost/profit,
  record payments, duplicate, soft-delete, share as text.
- **Quotations** — create / edit, statuses, validity, convert-to-bill.
- **Customers** — manage, see outstanding, one-tap payment reminders.
- **Companies** — profile, GST & numbering, UPI/bank, branding (accent, template, font), handbooks.
- **Payment reminders** — WhatsApp / SMS message + on-screen **UPI QR** (GPay/PhonePe scannable).
- **Reports** — sales, receivables, payments, profit/margin, quotations, customer statement,
  company summary, GST working summary. Share any report as CSV/text.
- **Settings** — currency, financial-year start, GST rates, footer, letter-pad spacing, reminder template.
- **Users (Admin)** — create / edit / delete team logins, per-operator menu access.

## Run it on your phone (no Android Studio needed)

1. Install the **Expo Go** app from the Play Store on your Android phone.
2. On this machine:
   ```bash
   cd mobile
   npm install        # first time only
   npx expo start
   ```
3. Scan the QR code shown in the terminal with Expo Go. The app loads on your phone.

Your phone and computer must be on the same Wi-Fi. If that fails, run
`npx expo start --tunnel`.

## Build an installable APK (cloud, no local Android SDK)

Uses Expo Application Services (EAS) — free tier is fine.

```bash
npm install -g eas-cli
eas login                       # create/sign in to an Expo account
eas build -p android --profile preview
```

When the cloud build finishes you get a download link for a standalone **.apk** you can
install on any Android device (or distribute).

## Backend / configuration

The Supabase URL + anon key live in [`src/config.ts`](src/config.ts). The anon key is a
public client key (row-level security protects the data). To point the app at a different
project, edit those two values. The database schema and the `admin-create-user` Edge
Function are shared with the web app (see `../supabase`).
