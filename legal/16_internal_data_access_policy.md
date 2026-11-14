# PHARMATRIX INTERNAL DATA ACCESS AND ROLE-BASED ACCESS CONTROL (RBAC) POLICY

**Document Reference:** PMX-SEC-RBAC-2026  
**Version:** 1.0.0  
**Effective Date:** November 14, 2026  
**Status:** Mandatory Internal Security & Data Governance Standard  

---

## 1. Objective and Principle of Least Privilege
The objective of this Internal Data Access Policy is to enforce the **Principle of Least Privilege (PoLP)** and zero-trust security architecture across Pharmatrix. No employee, contractor, system, or software process shall have access to more personal, business, or operational data than is strictly required to perform their authorized job function.

This Policy directly operationalizes the privacy mandates of Section 8 of the **Digital Personal Data Protection Act, 2023 ("DPDPA")** and standard ISO 27001 Access Control requirements.

---

## 2. Role-Based Access Control (RBAC) Hierarchy

The Pharmatrix backend enforces role authorization via `require_role(UserRole.ADMIN, ...)` in `app/core/auth.py`.

| Platform Role | Authorized Users | Permissions & Access Scope | Restrictions & Boundaries |
|---|---|---|---|
| **`CUSTOMER`** | Registered pharmacies, clinics, hospitals, distributors | - Access own business profile, premises locations, and uploaded documents.<br>- Request pickups, view assigned driver name and live ETA.<br>- Access exclusive 6-digit OTP and QR token for pickup verification.<br>- View and download own invoices, payment receipts, and CBWTF destruction certificates.<br>- Submit DSR export and account erasure requests. | - Strictly restricted from accessing other customers' pickups, invoices, or premises.<br>- Cannot view driver phone numbers (beyond operational assignment), driver home addresses, or driver telemetry outside active assigned route stops.<br>- Cannot access warehouse intake logs or CBWTF bulk shipment manifests. |
| **`DRIVER`** | Enrolled logistics personnel | - View assigned routes (`driver_routes`), sequence of stops, and destination addresses.<br>- Mark stop arrival, scan customer QR token, record collected weight, upload collection photographs.<br>- Verify customer-provided OTP.<br>- Access assigned vehicle information. | - **Strict OTP Isolation:** Drivers can **never** view the customer's raw OTP or QR verification secret in the app or API. They can only submit the OTP received from the customer for server-side verification.<br>- Cannot view customer financial ledgers, pricing plan terms, or other drivers' routes.<br>- No access to admin management panels or database records. |
| **`FACILITY`** | Common Bio-medical Waste Treatment Facility (CBWTF) operators | - View incoming and dispatched disposal shipments consigned to their specific facility (`facility_disposal_shipments`).<br>- Record received weighbridge weight and log discrepancy notes.<br>- Upload signed Form II manifests and CBWTF Destruction/Disposal Certificates. | - Cannot access customer identities, pharmacy drug licenses, customer pricing terms, or driver personal records.<br>- Cannot access shipments assigned to other disposal facilities.<br>- No access to customer invoices or billing engines. |
| **`ADMIN`** | Operations managers, dispatch coordinators, compliance officers | - Full management of customer onboarding, pricing plan assignments, vehicle fleets, routes, warehouse intakes, exceptions, and disposal shipments.<br>- Access system configuration and audit logs.<br>- Review and process DSR erasure requests. | - Operations admins cannot view raw database credentials, Supabase service keys, or Razorpay API secrets.<br>- Every administrative action (pricing change, status override, role modification) is permanently recorded in `audit_logs` and `configuration_audit` with actor identity and old/new values. |

---

## 3. Data Protection and Secret Isolation Standards

1. **OTP and Secret Safeguards:**
   - Raw OTPs are generated on the server and transmitted exclusively to the Customer Mobile App.
   - Database storage maintains exclusively a salted SHA-256 hash (`otp_hash`).
   - Neither Driver nor Admin UI exposes the customer OTP.
2. **Document & Photo Storage Access:**
   - Supabase storage buckets (`customer-documents`, `pickup-proofs`, `disposal-certificates`) are **private**.
   - Public unauthenticated read access is disabled.
   - All access is mediated through backend-generated, time-limited HMAC signed URLs (default TTL: 300 to 3600 seconds) issued only after verifying the requesting user's role and resource ownership.
3. **Database Access by Personnel:**
   - Direct production PostgreSQL database access using superuser credentials (`postgres`) is strictly restricted to designated database administrators (DBAs) and requires multi-factor authentication (MFA) and an active VPN/bastion host connection.
   - Routine application operations must use the FastAPI admin dashboard; manual SQL updates to live production data are prohibited without an approved change-control ticket.
4. **Credential Rotation:**
   - Database passwords, Supabase secret keys, Razorpay webhook secrets, and WhatsApp API tokens shall be rotated every **90 days**, or immediately upon departure of any senior engineering staff.

