# PHARMATRIX DATA RETENTION AND DISPOSAL POLICY

**Document Version:** 1.0.0  
**Effective Date:** November 14, 2026  
**Status:** Approved for Implementation & Periodic Automated Purge  

---

## 1. Objective and Regulatory Authority
The objective of this Data Retention and Disposal Policy ("**Policy**") is to establish clear, legally substantiated retention schedules for every category of information processed by Pharmatrix, balancing the principle of **storage limitation** under the Digital Personal Data Protection Act, 2023 ("DPDPA") with statutory preservation obligations under Indian tax, corporate, cyber, and environmental laws.

This Policy is grounded in:
1. **Bio-Medical Waste Management Rules, 2016** (Rule 13 - Annual Reporting & Record Maintenance);
2. **Central Goods and Services Tax Act, 2017 (Section 36)** & **Income Tax Act, 1961 (Section 44AA)**;
3. **Information Technology Act, 2000** & **CERT-In Cyber Security Directions (April 28, 2022)**;
4. **Digital Personal Data Protection Act, 2023 (Section 8(7))** (Requirement to erase personal data upon purpose fulfillment);
5. **Companies Act, 2013 (Section 128)** (Books of account preservation).

---

## 2. Retention Schedule by Data Category

| Category Code | Data Description | Purpose of Processing | Statutory Mandate / Operational Need | Minimum Retention Period | Maximum Retention Period | Post-Retention Disposal Method | Responsible System / Service |
|---|---|---|---|---|---|---|---|
| **RET-ACC** | User Account & Auth Profile (`users`, `customers`, `drivers`, `facilities`) | Authentication, account ownership, access control. | Contractual necessity; business relationship. | Active Account Tenure | Account Tenure + 3 years post-termination | Soft-delete / PII anonymization (masking email, name, phone) | `compliance_service` / Supabase GoTrue |
| **RET-DOC** | Customer Regulatory Documents (Drug licenses, SPCB consents) | Pharmacy legitimacy verification, drug non-diversion. | Drugs and Cosmetics Act, 1940; BMW Rules. | Active Account Tenure | 5 years post-account closure | Secure bucket purge via API | Supabase Storage (`customer-documents`) |
| **RET-LOC** | Customer Premises & GPS Coordinates (`customer_locations`) | Route planning and logistics pickup site history. | Logistics execution; dispute resolution. | Active Account Tenure | 3 years post-account closure | Anonymization of address line & contact details | PostgreSQL (`customer_locations`) |
| **RET-TEL** | Driver Real-Time GPS Telemetry (`drivers.current_latitude`, logs) | Active shift navigation, safety tracking, arrival verification. | Fleet dispatch; incident investigation. | Shift Duration | 90 days (active telemetry downsampled to summary route stop metrics) | Automated periodic cleanup cron | Background worker / PostgreSQL |
| **RET-PKP** | Waste Collection Records (`pickups`, `warehouse_intakes`, items) | Core waste collection, weight tracking, chain-of-custody. | **Rule 13, BMW Rules, 2016** (mandatory 5-year records). | **5 Years from Collection Date** | 7 Years from Collection Date | Archive to cold encrypted storage | PostgreSQL (`pickups`, warehouse tables) |
| **RET-PRF** | Collection Proof Photographs (scale reading, sealed bags) | Evidence of physical handover; discrepancy resolution. | Commercial dispute prevention; environmental verification. | 1 Year from Collection Date | 3 Years from Collection Date | Permanent purge from Supabase Storage | Supabase Storage (`pickup-proofs`) |
| **RET-VER** | OTP Verification Metadata (`otp_hash`, verification tokens) | Handover authorization non-repudiation. | Security and audit validation. | Handover Completion | **30 Days from Creation** | Automated database purge | `retention_service` |
| **RET-FIN** | Invoices, Payments, Razorpay Orders, Tax Records | Financial accounting, payment reconciliation, GST filing. | **Section 36, CGST Act, 2017** (mandatory 72 months from annual return date) & **Income Tax Act** (8 years). | **8 Years from Fiscal Year End** | 10 Years from Fiscal Year End | Secure permanent archive | PostgreSQL (`invoices`, `payments`, `razorpay_orders`) |
| **RET-DSP** | Disposal Shipments & CBWTF Destruction Certificates | Proof of lawful incineration/autoclaving of hazardous waste. | Environmental liability; CPCB/SPCB inspections. | **10 Years from Certificate Date** | Indefinite statutory legal archive | Maintained in permanent compliance repository | PostgreSQL / Storage (`disposal-certificates`) |
| **RET-DEV** | Device Push Notification Tokens (`device_tokens`) | Mobile alert delivery (pickup status, driver approaching). | Notification delivery. | Active App Usage | Inactive for **180 Days** | Hard delete from `device_tokens` table | `retention_service` |
| **RET-LOG** | Application & HTTP Request Logs (`method`, `path`, status, duration) | System reliability, debugging, security audits. | **CERT-In Direction 2022** (mandatory 180 days system log retention). | **180 Days** | 365 Days | Automated log file rotation and deletion | Server filesystem logrotate / cloud logs |
| **RET-AUD** | Business & Configuration Audit Logs (`audit_logs`, config changes) | Forensic tracking of price modifications, user privilege changes. | Corporate governance and security compliance. | **3 Years** | 5 Years | Move to immutable cold archive | PostgreSQL (`audit_logs`, `configuration_audit`) |
| **RET-CON** | User Consent & Preference Records (`user_consents`, marketing prefs) | Demonstrating lawful consent under DPDPA 2023. | **Section 6, DPDPA 2023** (accountability to prove consent). | Duration of Processing + **5 Years** post-consent withdrawal | 7 Years post-withdrawal | Cold storage archive | PostgreSQL (`user_consents`) |

---

## 3. Automated Retention Service Implementation
Pharmatrix provides an automated, idempotent retention worker script (`backend/app/services/retention_service.py`) scheduled to execute on a recurring basis:
1. **Device Token Purge:** Selects `device_tokens` where `is_active = false` or `updated_at < NOW() - INTERVAL '180 days'` and executes hard deletion.
2. **Expired OTP Cleanup:** Clears `otp_hash`, `otp_expires_at`, and verification tokens on completed or cancelled pickups older than **30 days**.
3. **Orphaned Storage Cleanup:** Identifies unreferenced temporary uploads in storage buckets older than 7 days and triggers deletion.
4. **Audit Logging:** Every automated retention execution produces an immutable record in `audit_logs` detailing the count of deleted/anonymized records and timestamp.

---

## 4. Legal Holds and Freeze on Deletion
Notwithstanding any standard retention timeframe, if Pharmatrix receives a formal legal notice, court subpoena, arbitration filing, or regulatory investigation from the State Pollution Control Board, Central Drugs Standard Control Organisation, or law enforcement agency:
- A **Legal Hold** shall be placed immediately on all associated records.
- Automated purge processes for the affected entities shall be suspended until formal written release by the Legal & Compliance Directorate.

