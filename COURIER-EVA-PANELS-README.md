# Courier Eva — Role Panels & Functional Demo

This build adds separate role-based panels and connected courier operations using browser localStorage for demo persistence.

## Demo login accounts

All demo passwords are `123456`.

| Role | Email | Panel |
|---|---|---|
| Super Admin | superadmin@couriereva.in | Full ERP / all branches |
| Admin | admin@couriereva.in | Full ERP |
| Branch Admin | branchadmin@couriereva.in | Branch operations + staff |
| Branch Staff | staff@couriereva.in | Bookings, tracking, POD, tasks, attendance |
| Collection Boy | collection@couriereva.in | Collections + attendance + tasks |
| Delivery Executive | delivery@couriereva.in | Delivery Portal + route + earnings + attendance |

## Separate panels

- `dashboard/panels/super-admin.html`
- `dashboard/panels/admin.html`
- `dashboard/panels/branch-admin.html`
- `dashboard/panels/staff.html`
- `dashboard/panels/collection-boy.html`
- `dashboard/panels/delivery.html`
- `dashboard/panels/staff-management.html`
- `dashboard/panels/delivery.html`

## Functional demo flows

- Role-based login and role-specific navigation
- Booking creation with tracking ID, sender/receiver, carrier, parcel, weight, dimensions, volumetric weight, charged weight, rate, GST and payment status
- Duplicate tracking ID validation
- Booking list/search
- Shipment tracking and status timeline
- POD / delivery status workspace
- Expense capture
- Finance and P&L snapshot
- Reports summary
- Staff creation and work assignment
- Staff attendance check-in/check-out
- Delivery queue with pickup/drop, weight, dimensions, shipment charge, COD and delivery earnings
- Delivery completion
- Browser geolocation request for delivery staff
- Collection confirmation/submission
- Customer enquiry capture
- Notifications and audit-log views
- Master setup overview
- Print-label action

## Production note

This static build is intended as a working browser demo. Real simultaneous multi-user authentication, PostgreSQL persistence, WhatsApp provider, courier tracking APIs/webhooks, secure server-side authorization, backups and production GPS tracking require the backend/API deployment described in the project requirements.
