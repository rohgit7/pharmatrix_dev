# PHARMATRIX THIRD-PARTY VENDOR COMPLIANCE REGISTER

**Document Reference:** PMX-REG-VEND-2026  
**Version:** 1.0.0  
**Effective Date:** November 14, 2026  
**Status:** Mandatory Data Processor & Subprocessor Due Diligence Register  

---

## 1. Statutory Due Diligence Requirement
Under **Section 8(2) of the Digital Personal Data Protection Act, 2023 ("DPDPA")**, a Data Fiduciary may engage, appoint, use or involve a Data Processor to process personal data on its behalf only under a **valid contract** containing appropriate data protection and confidentiality obligations.

This Vendor Compliance Register inventories all third-party services, APIs, cloud hosts, and infrastructure partners integrated into the Pharmatrix codebase, evaluating their data flows, hosting jurisdictions, security certifications, and contractual Data Processing Agreement (DPA) execution status.

---

## 2. Master Vendor Register

| Vendor Name & Legal Entity | Service / Component Integrated | Data Shared with Vendor | Processing Purpose | Primary Hosting Location | Security Certifications | Contractual Agreement Type | Compliance Status & Action Required |
|---|---|---|---|---|---|---|---|
| **Supabase Inc.** (Delaware, USA / AWS ap-south-1) | PostgreSQL Database, GoTrue Auth, Object Storage | User emails, password hashes, business profiles, pickup proofs, customer documents, driver telemetry | Database persistence, token generation, cryptographic file storage | AWS Mumbai (ap-south-1), India | SOC 2 Type II, ISO 27001, HIPAA compliant | Enterprise Cloud Terms & Data Processing Addendum (DPA) | **Requires Formal Execution:** Standard DPA incorporating Indian DPDPA compliance terms must be counter-signed. |
| **Razorpay Software Private Limited** (Bangalore, India) | Razorpay Checkout SDK, Orders API, Webhooks API | Customer name, billing email, phone number, invoice amount, payment references | Payment order generation, online transaction collection, settlement, refund processing | India (AWS Mumbai / local data centers) | PCI-DSS Level 1, ISO 27001, SOC 2 | Merchant Master Service Agreement (MSA) & Payment Gateway Terms | **Compliant / Active:** Razorpay is RBI-authorized Payment Aggregator. DPA embedded in Merchant Agreement. |
| **650 Industries Inc. (Expo)** (California, USA) | Expo Push Notification Service (`exp.host`) | Expo Push Notification Tokens, message alert title & body, metadata | Mobile push notification routing to Apple APNs and Google FCM | United States (AWS) | SOC 2 Type II | Expo Terms of Service & Privacy Policy | **Action Required:** Ensure notification payloads do NOT include sensitive patient names or raw medical formulas; restrict to operational alerts. |
| **Meta Platforms Ireland Ltd / Meta India** | WhatsApp Business Cloud API (`graph.facebook.com`) | Customer mobile phone number, driver phone, notification templates | Delivery of transactional pickup reminders, driver arrival notices, invoice links | Global / India Edge Nodes | ISO 27001, SOC 2, SOC 3 | Meta Business Terms, WhatsApp Business Terms of Service, DPA | **Requires Execution:** WhatsApp Business Account (WABA) verification and execution of Meta Business Data Processing Terms. |
| **Project OSRM / OpenStreetMap** (Community / Self-Hosted) | Open Source Routing Machine (`router.project-osrm.org`) | Coordinate pairs (Latitude & Longitude of pickup stops and warehouses). *No names or PII transmitted.* | Turn-by-turn route optimization, distance matrix computation, ETA estimation | Global CDN / OpenStreetMap servers | Open Source Software (ODbL / BSD) | Open Database License (ODbL) | **Operational Finding:** Public demo OSRM server (`router.project-osrm.org`) is currently used in `config.py`. Must migrate to dedicated private self-hosted OSRM container before production to prevent rate throttling and IP leakage. |
| **SMTP Email Provider** (Configurable in `.env`) | Transactional Email Dispatcher (`app.notifications.email`) | Customer email address, invoice attachments, dispatch notices | Delivery of PDF invoices, account activation links, disposal certificates | Configurable (e.g. AWS SES Mumbai / SendGrid) | ISO 27001, SOC 2 Type II | Standard Email Service Agreement & DPA | **Action Required:** Configure production SMTP credentials in `.env` pointing to an Indian-hosted SMTP provider (e.g., AWS SES Mumbai) with signed DPA. |
| **Common Bio-medical Waste Treatment Facilities (CBWTFs)** | Certified Disposal Facilities (Portal Users) | Shipment manifests (`DSP-XXXXXX`), waste category codes, consignment gross/net weights | Scientific incineration, autoclaving, and destruction certificate issuance | India (Physical Treatment Plants) | SPCB Consent to Operate (CTO), CPCB Authorizations | B2B Disposal Facility Interfacing Agreement (PMX-AGR-FAC-2026) | **Mandatory Action:** Physical bilateral execution of Facility Agreement with every partner CBWTF prior to routing consignments. |

---

## 3. Vendor Review and Auditing Protocol
1. **Annual Audit:** Every third-party vendor processing personal or operational data shall undergo an annual compliance review assessing security certification renewals (SOC 2, ISO 27001).
2. **Subprocessor Change Notifications:** Vendor contracts must stipulate at least thirty (30) days' advance notice before onboarding new subprocessors that access production data.
3. **Data Return and Destruction Upon Termination:** Upon contract termination, vendors are contractually bound to permanently expunge or return all Pharmatrix data within thirty (30) days.

