# PHARMATRIX PRIVACY POLICY

**Document Version:** 1.0.0  
**Effective Date:** November 14, 2026  
**Last Updated:** November 14, 2026  
**Status:** Subject to Final Corporate & Legal Counsel Approval  

---

## 1. Introduction and Scope

This Privacy Policy ("**Policy**") governs the collection, storage, processing, transfer, and safeguarding of personal and commercial data by **Pharmatrix Technologies Private Limited** (hereinafter referred to as "**Pharmatrix**", "**we**", "**us**", or "**our**") in connection with the Pharmatrix digital platform, comprising:
- The **FastAPI Backend Services** (`api.pharmatrix.com` and related microservices);
- The **Pharmatrix Customer Mobile Application** (iOS and Android);
- The **Pharmatrix Driver Mobile Application** (iOS and Android);
- The **Pharmatrix Facility Web Portal**;
- The **Pharmatrix Admin & Operations Dashboard**; and
- All associated APIs, cloud infrastructure, notifications, and scheduled logistics workflows (collectively, the "**Platform**").

Pharmatrix operates a specialized B2B technology platform facilitating scheduled collection, transportation, consolidation, and authorized scientific disposal of pharmaceutical, biomedical, and chemical waste for licensed commercial healthcare and pharmaceutical entities (including pharmacies, hospitals, clinics, and pharmaceutical distributors).

This Policy is formulated in strict accordance with:
1. **The Digital Personal Data Protection Act, 2023 ("DPDPA 2023")** (India);
2. **The Information Technology Act, 2000** and the *Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 ("SPDI Rules")*;
3. **The Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021**;
4. **The Bio-Medical Waste Management Rules, 2016** (notified under the Environment (Protection) Act, 1986); and
5. Global privacy principles including the **General Data Protection Regulation (EU) 2016/679 ("GDPR")** to the extent that any processing involves foreign corporate representatives or international data transfers.

---

## 2. Roles: Data Fiduciary vs. Data Processor

Under the DPDPA 2023:
- **Pharmatrix as Data Fiduciary:** Pharmatrix determines the purpose and means of processing personal data relating to user account registration, billing, system security, driver fleet monitoring, and statutory waste compliance reporting.
- **Customers as Independent Data Fiduciaries:** Licensed business customers (pharmacies, distributors, healthcare facilities) that register their authorized personnel, pharmacists, and contact persons are responsible for ensuring that they possess valid legal authority to share employee and premises details with Pharmatrix.
- **Disposal Facilities and Processing Partners:** Third-party Common Bio-medical Waste Treatment Facilities ("CBWTFs"), cloud hosting providers, and payment gateways process personal data as **Data Processors** strictly under contractual covenants.

---

## 3. Data Categories Collected by the Platform

The table below provides a comprehensive inventory of all personal, device, location, and operational data collected across the Pharmatrix product:

| Data Category | Specific Data Elements | Purpose of Collection | Collection Mechanism | Storage Location & Safeguards | Access Control & Recipients | Retention Period |
|---|---|---|---|---|---|---|
| **Identity & Account Information** | Full legal name, business contact person name, authorized pharmacist/manager name, email address, hashed authentication credentials, account role (`ADMIN`, `DRIVER`, `CUSTOMER`, `FACILITY`), active/inactive status. | User registration, authentication, access authorization, role-based session enforcement, communication. | User registration form, Supabase GoTrue authentication API. | PostgreSQL database (`users` table), Supabase Auth (`auth.users`). Encrypted at rest (AES-256). | Customer, assigned Admin. Not shared externally except auth provider. | Duration of active business contract + 7 years (statutory tax & corporate records). |
| **Business & Facility Profile** | Registered entity name, trade name, customer code (`CUST-XXXXXX`), customer type (`PHARMACY`, `DISTRIBUTOR`, `HOSPITAL`, `CLINIC`), GSTIN, State drug licenses (Form 20/21/20B/21B), Pollution Control Board consents (CTE/CTO), clinic bed count. | Commercial verification, statutory pharmaceutical legitimacy validation, invoicing, hazardous waste categorization. | Customer onboarding workflow, document upload API. | PostgreSQL (`customers`, profiles), Supabase Storage bucket (`customer-documents`). | Customer, compliance admins. Drug license details shared with State Pollution Boards if mandated. | Duration of business relationship + 5 years past account closure. |
| **Facility & Pickup Locations** | Physical address line 1 & 2, landmark, city, state, postal code, GPS latitude and longitude, location contact name and phone number, premises access photos. | Logistics routing, route optimization algorithms, driver navigation, verification of waste generation site. | Address input form, interactive map coordinate selector, device GPS. | PostgreSQL (`customer_locations`), cached in route optimizer. | Drivers assigned to active routes, operations dispatch, customer. | Retained indefinitely for location history unless customer requests location deletion. |
| **Driver & Fleet Telemetry** | Driver full name, employee ID, mobile phone number, driver license number, driving license expiry date, assigned vehicle registration number (RC), vehicle payload capacity, real-time GPS coordinates, last location timestamp. | Driver onboarding, vehicle-driver dispatch assignment, live route navigation, transit tracking, safe handling verification. | Driver onboarding portal, driver mobile app background location services. | PostgreSQL (`drivers`, `vehicles`, `driver_vehicle_assignments`). | Operations dispatchers, customers (viewing approaching driver only). | Driver profile: employment tenure + 3 years. Real-time GPS traces: 90 days, then downsampled or archived. |
| **Pickup Records & Waste Data** | Pickup code (`PKP-XXXXXX`), requested pickup date, scheduled window, waste bin classification (`YELLOW`, `RED`, `WHITE`, `BLUE`, `BROWN`), waste streams (expired medicine, cytotoxic, sharps, recyclable, glassware), estimated weight, actual collected weight, remarks. | Core waste collection workflow, manifest generation, billing computation, chain-of-custody tracking. | Customer pickup request screen, driver weighing card. | PostgreSQL (`pickups`, `warehouse_intakes`, `warehouse_intake_items`). | Customer, assigned driver, warehouse intake managers, authorized CBWTF. | Mandatory minimum 5 years pursuant to Rule 13 of Bio-Medical Waste Management Rules, 2016. |
| **Photographic Proofs & Evidence** | Collection proof photographs (photographs of sealed waste bags with barcode labels, digital scale reading displaying consignment weight). | Chain-of-custody evidence, fraud prevention, discrepancy resolution between customer and driver. | Camera module in Driver mobile application. | Supabase Storage (`pickup-proofs` bucket). Accessed exclusively via short-lived HMAC signed URLs (TTL: 3600s). | Customer, driver who captured image, operations manager, dispute resolution staff. | 3 years from pickup date for dispute prevention and compliance audit. |
| **Verification & Security Secrets** | Cryptographic QR verification token, 6-digit one-time password (OTP) SHA-256 hash, OTP expiry timestamp, OTP attempt counter, cooldown timestamps. | Non-repudiation of physical handover; ensuring waste is transferred only to authorized driver. | Backend verification service, Customer app QR/OTP display. | PostgreSQL (`pickups` table). Raw OTP is never stored in plaintext. | Customer sees OTP/QR in-app; Driver inputs OTP to verify. Admin/Driver cannot view raw OTP in DB. | Hashed values purged after verification or expiration (max 30 days retention). |
| **Financial & Payment Information** | Razorpay Order ID, Razorpay Payment Reference ID, payment method (`UPI`, `CARD`, `NETBANKING`), payment status (`COMPLETED`, `FAILED`), invoice amount, GST breakdown (CGST/SGST/IGST). *Note: No credit card numbers, CVVs, or bank netbanking passwords are ever stored by Pharmatrix.* | Payment processing, invoice settlement, tax accounting, refund dispute resolution. | Razorpay payment SDK, Razorpay Webhook API (`X-Razorpay-Signature` verified). | PostgreSQL (`payments`, `invoices`, `razorpay_orders`, `razorpay_webhook_events`). | Customer, finance admins, Razorpay. | 8 years pursuant to the Income Tax Act, 1961 and Central Goods and Services Tax (CGST) Act, 2017. |
| **Disposal Certificates & Manifests** | Form II waste manifests, shipment codes (`DSP-XXXXXX`), Common Bio-medical Waste Treatment Facility (CBWTF) receipt confirmation, signed destruction certificates, manifest numbers, incineration/autoclaving dates. | Statutory environmental compliance, pollution control board audits, proof of non-diversion of expired drugs. | Facility portal certificate upload API, CBWTF integration. | PostgreSQL (`disposal_shipments`, `disposal_certificates`), Supabase Storage (`disposal-certificates`). | Customer (certificate download), CBWTF, State Pollution Control Board, Pharmatrix compliance. | Permanent / minimum 10 years for statutory environmental compliance. |
| **Device & Push Telemetry** | Expo Push Notification Token, device platform (`Android` / `iOS`), device hardware model, active notification status. | Delivery of real-time pickup status alerts, driver approaching notifications, OTP delivery, invoices. | Mobile app launch (via Expo Device & Notifications SDK). | PostgreSQL (`device_tokens`). | Internal notification dispatcher service, Expo Push Notification servers (650 Industries). | Active until app uninstall, token refresh, or customer opt-out. Inactive tokens purged after 180 days. |
| **System & Access Audit Logs** | Request timestamp, HTTP verb, URL path, HTTP response status, execution duration in milliseconds, authenticated actor ID, changed entity, diff of previous vs new configuration values. | Platform security, breach detection, administrative accountability, forensic audits. | Backend logging middleware (`log_request`), audit service. | Application log files, PostgreSQL (`audit_logs`, `configuration_audit`). | Super Admins, Security and Compliance Officers. | 3 years minimum (conforming to CERT-In Cyber Security Directions, 2022). |

---

## 4. Legal Grounds for Processing (DPDPA & GDPR)

Under Section 4 and Section 7 of the DPDPA 2023, and Article 6 of the GDPR, Pharmatrix processes personal data strictly on the following lawful grounds:

1. **Consent (Section 6, DPDPA):**
   - Free, specific, informed, unconditional, and unambiguous consent obtained during account registration and onboarding.
   - Separate, opt-in consent for promotional and non-essential communications.
   - Explicit permission prompts for device camera (evidence capture) and GPS location tracking.
2. **Contractual Performance (Section 7(b), DPDPA / Art. 6(1)(b) GDPR):**
   - Processing necessary to execute service agreements: scheduling pickups, dispatching drivers, calculating route logistics, issuing invoices, and generating disposal certificates.
3. **Compliance with Legal Obligations (Section 7(c), DPDPA / Art. 6(1)(c) GDPR):**
   - Mandatory records under the **Bio-Medical Waste Management Rules, 2016** (maintenance of Form II manifests and annual records for 5 years).
   - Invoicing and tax retention under the **Central Goods and Services Tax Act, 2017**.
   - Compliance with cyber incident log retention (180 days) under **CERT-In Directions, 2022**.
4. **Legitimate Uses (Section 7, DPDPA):**
   - Prevention of corporate fraud, unauthorized drug diversion, safety of drivers handling potentially hazardous pharmaceuticals, and physical security of consignment handover.

---

## 5. Mobile Permissions and Location Tracking

### 5.1 Customer Mobile Application
- **Location Permission (`ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`):** Used solely when pin-pointing the customer's pickup address on the map during onboarding or adding a new branch location. We do **not** track customer locations in the background.
- **Push Notification Permission:** Used to transmit time-critical pickup status alerts, OTP arrival, driver approach notices, and billing receipts. Users may disable push notifications via device settings at any time without losing core scheduling capabilities.

### 5.2 Driver Mobile Application
- **Background and Foreground Location (`ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`):** Required to provide real-time route execution, turn-by-turn navigation, geofenced arrival check-ins, and safety tracking during active duty shifts. Location tracking begins upon driver shift check-in and ends immediately upon terminal handover or shift completion.
- **Camera Permission (`CAMERA`):** Required for drivers to scan physical QR tags on waste bins and capture photographic evidence of collected consignments and scale measurements. Images are uploaded directly to encrypted cloud storage and are not stored in the device's public photo gallery.

---

## 6. Data Sharing and Third-Party Disclosures

Pharmatrix does **not** sell, rent, or trade personal data to third parties for marketing purposes. Data is shared strictly on a need-to-know basis with the following verified entities:

1. **Disposal Facilities (CBWTFs):** Consignment codes, waste category classifications, received weights, and pickup batch references are shared to enable statutory treatment (incineration, autoclaving) and certificate generation.
2. **Payment Gateway (Razorpay):** Invoice identifiers, outstanding amounts, and customer contact details (name, email, phone) are shared with Razorpay Software Private Limited for payment tokenization and processing. All card data is handled directly by Razorpay under PCI-DSS Level 1 compliance.
3. **Cloud Infrastructure and Storage (Supabase / AWS):** Encrypted database storage, user authentication, and secure bucket storage for documents and photographs.
4. **Push Notification Infrastructure (Expo / 650 Industries):** Device push tokens and encrypted alert payloads.
5. **Government and Regulatory Authorities:** State Pollution Control Boards (SPCBs), Central Pollution Control Board (CPCB), Central Drugs Standard Control Organisation (CDSCO), and law enforcement agencies where disclosure is mandated by applicable law, court order, or formal regulatory investigation.

---

## 7. Data Storage, Security, and Cross-Border Transfers

- **Primary Data Residency:** All production databases, Supabase cloud assets, and file repositories are hosted in secure enterprise data centers located within the **Republic of India** (AWS Asia Pacific - Mumbai region / Supabase India region), satisfying national data localization requirements.
- **Security Measures:**
  - AES-256 encryption at rest for all database tables and cloud object storage.
  - TLS 1.3 encryption in transit for all client-to-server and server-to-server communications.
  - Cryptographic JSON Web Key Sets (JWKS) token validation with strict expiration and audience verification.
  - Role-Based Access Control (RBAC) enforcing least-privilege principles.
  - Short-lived HMAC signed URLs for all access to sensitive photographic proof and document files.
  - Rate limiting on sensitive endpoints (login, OTP requests, invoice generation).
- **Cross-Border Transfers:** If any technical telemetry or notification routing traverses international network infrastructure, such transfers are conducted under robust Data Transfer Agreements incorporating standard contractual clauses in accordance with Section 16 of the DPDPA 2023.

---

## 8. Data Retention and Erasure Schedule

Data is retained only as long as necessary to fulfill the purposes for which it was collected, or as mandated by law:
- **Active Account Data:** Retained for the duration of the commercial relationship.
- **Invoices, Payments, Tax Records:** Retained for **8 years** under the CGST Act and Income Tax Act.
- **Biomedical Waste Handover Records & Manifests:** Retained for **5 years** under Bio-Medical Waste Management Rules, 2016.
- **Security and Access Logs:** Retained for **180 days** (system logs) to **3 years** (audit trail) under CERT-In guidelines.
- **OTP Hashes and Transient Session Data:** Retained for **30 days** and automatically purged.
- **Device Tokens:** Automatically deactivated and purged after **180 days** of inactivity.

---

## 9. Your Legal Rights (Data Subject / Data Principal Rights)

Under the DPDPA 2023 and applicable privacy laws, users have the following rights:
1. **Right to Access (Section 11, DPDPA):** Request a summary of your personal data processed by Pharmatrix, the identities of all third parties with whom it has been shared, and an export in machine-readable JSON format.
2. **Right to Correction and Updating (Section 12, DPDPA):** Request correction of inaccurate, misleading, or outdated personal information.
3. **Right to Erasure (Section 12, DPDPA):** Request deletion of your personal data. *Please note: Deletion requests cannot erase statutory pickup manifests, tax invoices, and environmental disposal records that Pharmatrix is legally required to maintain under Indian law.*
4. **Right of Grievance Redressal (Section 13, DPDPA):** Lodge a complaint regarding our data practices with our designated Grievance Officer.
5. **Right to Nominate (Section 14, DPDPA):** Designate an authorized representative to exercise data rights in the event of death or incapacity.

### How to Exercise Your Rights:
- **In-App:** Access the **Profile > Privacy & Data Rights** section in the Customer Mobile App to export your account data or submit an erasure request.
- **Via Email:** Submit a written request to our Data Protection Officer at `privacy@pharmatrix.com`. Requests will be authenticated and resolved within **30 days** of receipt.

---

## 10. Protection of Minors

Pharmatrix is an enterprise business-to-business platform designed exclusively for licensed commercial entities and adult professional drivers. We do not knowingly collect, process, or solicit personal data from individuals under 18 years of age. If we become aware that a minor's information has been provided, we will immediately delete such data.

---

## 11. Grievance Officer & Contact Information

In compliance with the Information Technology Act, 2000, the SPDI Rules, and Section 13 of the DPDPA 2023, the contact details of our designated Grievance Officer are:

- **Grievance Redressal Officer:** Legal & Compliance Directorate
- **Entity:** Pharmatrix Technologies Private Limited
- **Postal Address:** Corporate Office, Level 4, Healthcare Logistics Tower, Whitefield, Bangalore, Karnataka – 560066, India
- **Email:** `grievance@pharmatrix.com` / `privacy@pharmatrix.com`
- **Response Timeline:** Within 24 hours acknowledgment; full resolution within 30 days.

If you are unsatisfied with our resolution, you retain the statutory right to escalate the complaint to the **Data Protection Board of India**.

---

## 12. Updates to this Policy

We may periodically revise this Policy to reflect operational improvements, technological enhancements, or statutory amendments. Significant changes will be communicated via in-app banners, email notifications, or push alerts at least **15 days** prior to taking effect. Continued use of the Platform after the effective date constitutes acknowledgment of the updated Policy.

