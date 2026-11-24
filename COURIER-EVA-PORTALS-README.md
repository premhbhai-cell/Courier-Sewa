# Courier Eva — Separate Portal Architecture

Public website now has separate header buttons for:
- Customer Portal
- Admin Login
- Staff Panel
- Delivery Portal
- ERP Login

Admin demo credentials (as requested):
- Email: currerseva5486@gmail.com
- Password: currierseva556649

Staff demo:
- staff@couriereva.in / staff123

Delivery demo:
- delivery@couriereva.in / delivery123

Customer demo: any non-empty email/mobile and password in the customer login.

The portal layer uses JavaScript + localStorage for the browser demo. It is NOT a security boundary for production. Production access control must be enforced server-side with authenticated sessions/JWT, database RBAC, branch isolation, password hashing, audit logs, and API authorization.
