# Courier Sewa - Requirement Implementation

This build extends the supplied Courier Sewa website/dashboard using the uploaded Courier Sewa requirements document as the source of truth.

## Added/extended
- ERP Feature Center: central entry point for requirement coverage.
- Finance & Accounts: cash/online/credit collection records, status, branch, notes and CSV export.
- Collection Boy workflow: packet collection confirmation, payment status and submission history.
- Notifications: configurable WhatsApp/email/in-app channels and required notification triggers.
- Audit Logs: user/module/action/record/change history.
- Public service cards: Domestic, International, Express/Urgent, Document & Parcel.
- Sidebar navigation updated across dashboard pages.

## Existing modules retained and surfaced
- Booking / All Bookings
- POD and POD upload
- Expenses
- Reports
- Master Setup
- Tracking
- Clients / Receivers
- Invoices / Ledger / Billing / Transactions
- Complaints / Enquiries
- Attendance / Staff / Roles
- WhatsApp settings
- Branches / Carriers / Rates / Locations

## Important
The uploaded requirements document calls for backend/API integrations (tracking providers, WhatsApp, email, authentication, database, backups, etc.). This ZIP is a frontend/static build; the new pages use browser localStorage for demo persistence where a live backend endpoint is not available. Production API/database wiring still needs the server-side implementation and credentials.

