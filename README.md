# Pharmatrix – Regulated Pharmaceutical Waste Logistics & Compliance Platform

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.141+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React Native](https://img.shields.io/badge/React_Native-0.88-61DAFB?style=flat&logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_58-000020?style=flat&logo=expo&logoColor=white)](https://expo.dev/)
[![React](https://img.shields.io/badge/React-18/19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_15+-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## Table of Contents

1. [Executive Overview](#executive-overview)
2. [Platform Architecture](#platform-architecture)
3. [Repository Structure](#repository-structure)
4. [Technology Stack](#technology-stack)
5. [Core Functional Modules](#core-functional-modules)
   - [Route Optimization & Fleet Dispatch (VRP)](#1-route-optimization--fleet-dispatch-vrp)
   - [Dynamic Pricing, Weighing & Invoicing](#2-dynamic-pricing-weighing--invoicing)
   - [Chain of Custody & Cryptographic Handover](#3-chain-of-custody--cryptographic-handover)
   - [Autonomous Background Workers](#4-autonomous-background-workers)
   - [Legal, Regulatory & Privacy Compliance (DPDP Act)](#5-legal-regulatory--privacy-compliance-dpdp-act)
6. [Prerequisites](#prerequisites)
7. [Installation & Local Setup](#installation--local-setup)
   - [1. Backend Setup](#1-backend-setup)
   - [2. Customer Mobile App](#2-customer-mobile-app)
   - [3. Driver Mobile App](#3-driver-mobile-app)
   - [4. Admin Operations Dashboard](#4-admin-operations-dashboard)
   - [5. Facility Disposal Portal](#5-facility-disposal-portal)
8. [Environment Configuration Reference](#environment-configuration-reference)
9. [API Documentation](#api-documentation)
10. [Testing & Quality Assurance](#testing--quality-assurance)
11. [Production Hardening & Deployment](#production-hardening--deployment)
12. [Legal Documentation & Compliance Inventory](#legal-documentation--compliance-inventory)

---

## Executive Overview

**Pharmatrix** is an enterprise-grade coordination and evidence platform for regulated pharmaceutical waste logistics and compliance. It connects pharmaceutical distributors, wholesalers, and healthcare institutions with licensed hazardous transporters and authorized disposal facilities.

Aligned with the **Central Drugs Standard Control Organisation (CDSCO)** May 2025 guidelines and the **Bio-Medical Waste Management Rules**, Pharmatrix enables two distinct disposal pathways:
1. **Return-to-Supplier (RTS)**: Coordinated reverse logistics for expired drug returns, manufacturer credits, and recovery.
2. **Authorized Disposal (AD)**: Licensed destruction, incineration, and treatment with immutable chain-of-custody logging and digital certificates of destruction.

Pharmatrix operates on an **asset-light coordination model**—it does not own vehicles or incinerators. Instead, it provides the cryptographic system of record, multi-vehicle route optimization, dynamic billing, automated verification, and regulatory audit trail required for compliant hazardous material transport.

---

## Platform Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATIONS                           │
├───────────────────┬───────────────────┬────────────────┬───────────────┤
│ Customer Mobile   │ Driver Mobile     │ Admin Web      │ Facility Web  │
│ React Native/Expo │ React Native/Expo │ React/Vite/TS  │ React/Vite/TS │
└─────────┬─────────┴─────────┬─────────┴────────┬───────┴───────┬───────┘
          │                   │                  │               │
          └───────────────────┼──────────────────┴───────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FASTAPI BACKEND SERVICE                         │
│       FastAPI • Uvicorn • Pydantic v2 • SlowAPI • SQLAlchemy 2.0       │
├─────────────────────────────┬──────────────────────────────────────────┤
│ Route Optimization (VRP/TSP)│ Billing & Dynamic Invoicing Engine       │
├─────────────────────────────┼──────────────────────────────────────────┤
│ Cryptographic OTP & Proofs  │ Background Workers (Reminders/Escalation)│
├─────────────────────────────┼──────────────────────────────────────────┤
│ DPDP Act / DSR Privacy Suite│ Operational Exception Monitoring         │
└─────────────────────────────┴──────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  DATABASE & RLS  │ │  CLOUD STORAGE   │ │ EXTERNAL / SAAS  │
│ Supabase PostgreS│ │ Supabase Storage │ │ Razorpay Gateway │
│ Alembic Migration│ │ S3 Proof Buckets │ │ Meta WhatsApp API│
│ Tx Pooler (6543) │ │ Supabase Auth JWT│ │ Expo Push (APNs) │
└──────────────────┘ └──────────────────┘ │ OSRM Road Router │
                                          └──────────────────┘
```

---

## Repository Structure

```
pharmatrix_dev/
├── backend/                        # FastAPI Python backend application
│   ├── app/
│   │   ├── api/                    # Route handlers (auth, pickups, admin, driver, etc.)
│   │   ├── core/                   # Config, database, security, rate limiting, logging
│   │   ├── models/                 # SQLAlchemy 2.0 ORM models (39 relational tables)
│   │   ├── optimizer/              # Custom VRP/TSP route solver & Haversine/OSRM providers
│   │   ├── schemas/                # Pydantic v2 request/response schemas
│   │   └── services/               # Business logic, pricing, invoicing, workers, compliance
│   ├── migrations/                 # Alembic migration scripts and SQL RLS hardening scripts
│   ├── tests/                      # Pytest test suites (68 automated test suites)
│   ├── requirements.txt            # Python dependencies
│   └── seed_route_optimization_data.py # Development fleet seed script
├── frontend_customer/              # Customer mobile app (React Native, Expo SDK 58)
│   ├── src/features/               # Auth, onboarding, pickups, payments, profile, privacy
│   └── src/services/               # API client, AsyncStorage, push notification handlers
├── frontend_driver/                # Driver mobile app (React Native, Expo SDK 58)
│   ├── src/features/               # Route view, stop execution, camera proofs, OTP verify
│   └── src/services/               # Background location telemetry, API client, offline cache
├── frontend_admin/                 # Operations control tower (React 18, Vite 5, Tailwind CSS)
│   ├── src/pages/                  # Live dispatch map, route optimizer, pricing, audits
│   └── src/components/             # Leaflet GIS maps, metric cards, exception drawers
├── frontend_facility/              # Treatment facility portal (React 18, Vite 5, Tailwind CSS)
│   ├── src/pages/                  # Inbound shipments, weight intake, certificate upload
│   └── src/api/                    # Axios API client and session interceptors
├── legal/                          # Complete legal, privacy, and regulatory documentation (17 docs)
└── pharmatrix_system_design.md     # Technical system design blueprint
```

---

## Technology Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) `0.141.1` on [Uvicorn](https://www.uvicorn.org/) `0.53.0`
- **Runtime**: Python `3.10+`
- **ORM & Database**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) `2.0.54` + [Alembic](https://alembic.sqlalchemy.org/) `1.20.0`
- **Database Driver**: [Psycopg 3](https://www.psycopg.org/) `3.3.6` (PostgreSQL C-extension)
- **Validation**: [Pydantic v2](https://docs.pydantic.dev/) `2.13.5` + `pydantic-settings 2.15.0`
- **Rate Limiting**: [SlowAPI](https://github.com/laurentS/slowapi) `0.1.10`
- **Testing**: [Pytest](https://pytest.org/) `9.1.1` with `pytest-xdist` and `anyio`

### Frontends
- **Mobile Apps (Customer & Driver)**:
  - [React Native](https://reactnative.dev/) `0.88.0` with [React 19](https://react.dev/)
  - [Expo SDK 58](https://expo.dev/) with [Expo Router v58](https://docs.expo.dev/router/introduction/)
  - [TanStack React Query v5](https://tanstack.com/query/latest)
  - [Lucide React Native](https://lucide.dev/) icons
  - Hardware Integrations: `expo-camera`, `expo-location`, `expo-notifications`, `expo-secure-store`, `expo-print`
- **Web Dashboards (Admin & Facility)**:
  - [React 18](https://react.dev/) bundled with [Vite 5](https://vitejs.dev/)
  - [Tailwind CSS 3.4](https://tailwindcss.com/) with PostCSS
  - [Leaflet](https://leafletjs.com/) interactive GIS OpenStreetMap integration
  - [Axios](https://axios-http.com/) with session interceptors

### Database & Third-Party Infrastructure
- **Database**: [Supabase PostgreSQL 15+](https://supabase.com/) with Transaction Connection Pooling (port 6543)
- **Storage**: Supabase S3-compatible buckets (`customer-documents`, `pickup-proofs`, `disposal-certificates`)
- **Authentication**: Supabase Auth with JWT and Row Level Security (RLS) policies
- **Payment Gateway**: [Razorpay](https://razorpay.com/) (Orders API, Webhooks, HMAC verification, Web/Native Checkout)
- **Routing Engine**: [Project-OSRM](http://project-osrm.org/) road network distance matrix
- **Messaging & Notifications**:
  - [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/) (v23.0)
  - [Expo Push Notification Service](https://docs.expo.dev/push-notifications/overview/) (APNs / FCM)
  - Transactional SMTP over TLS (SendGrid / AWS SES)

---

## Core Functional Modules

### 1. Route Optimization & Fleet Dispatch (VRP)
- Custom Vehicle Routing Problem (VRP) solver with multiple restarts and time limits.
- Supports vehicle capacity boundaries, directional sector clustering, and warehouse depot constraints.
- Integrated with Open Source Routing Machine (OSRM) to calculate realistic driving distances, travel times, and turn-by-turn road geometries.
- Cross-vehicle overlap detection ensures fleet efficiency and prevents territory conflicts.

### 2. Dynamic Pricing, Weighing & Invoicing
- **Snapshot Pricing**: Every pickup captures a point-in-time snapshot of the active pricing plan to prevent retroactive invoice drift.
- **Dual Weight Verification**: Calculates charges based on billed weight, minimum pickup adjustments, and tiered excess weight rates.
- **Idempotent Invoicing**: Automated invoice generation upon driver weight recording, locking balances against duplicate charge attempts.
- **Payment Processing**: Full Razorpay lifecycle support—order generation, mobile Web Checkout fallback, native SDK integration, signature verification, and automated receipt generation.

### 3. Chain of Custody & Cryptographic Handover
- **Time-Limited OTP**: Dynamic 6-digit OTP generated via HMAC-SHA256, expiring in 15 minutes with rate-limited verification.
- **QR Code Verification**: High-entropy verification tokens encoded in QR barcodes scanned by drivers via `expo-camera`.
- **Photo Proof of Collection**: Secure upload of container photographs with client-side compression and SHA-256 integrity validation.
- **Weight Reconciliation**: Driver-recorded collected weight matched against facility intake weight with automated tolerance checks (default 5.0% variance).

### 4. Autonomous Background Workers
- **Notification Worker**: Dispatches queued notifications across WhatsApp, Email, Push, and In-App channels.
- **Pickup Reminder Worker**: Alerts customers 24 hours and 2 hours prior to scheduled collection windows.
- **Exception Escalation Worker**: Automatically flags weight discrepancies, missed stops, or verification failures to admin control towers.
- **Configuration Scheduler**: Activates scheduled pricing and operational policy changes at exact effective timestamps without server restarts.

### 5. Legal, Regulatory & Privacy Compliance (DPDP Act)
- **Digital Personal Data Protection Act, 2023 (India)** & **GDPR** compliant architecture.
- **Granular Consent Capture**: Explicit opt-in for Terms & Conditions, Privacy Policy, and optional marketing channels during registration.
- **Data Subject Rights (DSR)**:
  - User Data Export: Instant JSON export of customer personal and pickup profile data.
  - Right to Erasure: Safe anonymization of PII while preserving legally mandated tax and hazardous waste manifests.
- **Automated Data Retention Cleanup**: Background worker purging expired push tokens (>180 days) and OTP hashes (>30 days).

---

## Prerequisites

Before setting up the project locally, ensure you have the following installed:
- **Python**: `3.10` or higher
- **Node.js**: `18.x` or `20.x` (LTS recommended)
- **Package Managers**: `npm` (bundled with Node) or `pnpm`
- **Expo CLI**: `npx expo` (no global installation required)
- **Git**
- **PostgreSQL / Supabase Account**: A hosted Supabase project or local PostgreSQL instance.

---

## Installation & Local Setup

### 1. Backend Setup

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a Python virtual environment
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
copy .env.example .env
# Edit .env and supply your DATABASE_URL, SUPABASE_*, and RAZORPAY_* credentials

# 5. Run database migrations
alembic upgrade head

# 6. Start the development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API will be available at `http://localhost:8000`. Interactive documentation is available at `http://localhost:8000/docs`.

---

### 2. Customer Mobile App

```bash
cd frontend_customer

# Install dependencies
npm install

# Start the Expo development server
npx expo start
```
- Press **`a`** to open in Android Emulator, **`i`** for iOS Simulator, or scan the QR code with **Expo Go** on your physical phone.
- Press **`w`** to preview in the web browser.

---

### 3. Driver Mobile App

```bash
cd frontend_driver

# Install dependencies
npm install

# Start the Expo development server
npx expo start
```
- Open in **Expo Go** on an Android or iOS device to utilize camera scanning and GPS tracking.

---

### 4. Admin Operations Dashboard

```bash
cd frontend_admin

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
The Admin Control Center will be accessible at `http://localhost:5173`.

---

### 5. Facility Disposal Portal

```bash
cd frontend_facility

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
The Facility Portal will be accessible at `http://localhost:5174` (or next available port).

---

## Environment Configuration Reference

### Backend (`backend/.env`)

| Variable | Description | Example / Default |
|---|---|---|
| `APP_NAME` | Name of the platform instance | `Pharmatrix` |
| `APP_ENV` | Application environment (`development` / `production`) | `development` |
| `DEBUG` | Enable debug mode (must be `False` in production) | `False` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:6543/postgres` |
| `SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Public anon key | `eyJhbGciOi...` |
| `SUPABASE_SECRET_KEY` | Service role admin key | `eyJhbGciOi...` |
| `SUPABASE_STORAGE_BUCKET` | Customer document storage bucket | `customer-documents` |
| `SUPABASE_PICKUP_PROOF_BUCKET`| Pickup collection photo bucket | `pickup-proofs` |
| `SUPABASE_DISPOSAL_CERTIFICATE_BUCKET`| Disposal certificate bucket | `disposal-certificates` |
| `CORS_ORIGINS` | Allowed origins (comma-separated, no `*` in prod) | `http://localhost:5173,http://localhost:5174` |
| `OSRM_BASE_URL` | Routing service endpoint | `https://router.project-osrm.org` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | `rzp_test_...` or `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | `secret_key...` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret for verifying payment webhook signatures | `webhook_secret...` |
| `RAZORPAY_CURRENCY` | Currency code | `INR` |
| `SMTP_HOST` | Transactional email host | `smtp.sendgrid.net` |
| `SMTP_PORT` | SMTP port | `587` |
| `WHATSAPP_PROVIDER` | WhatsApp provider (`META`) | `META` |
| `WHATSAPP_ACCESS_TOKEN` | Meta Graph API permanent access token | `EAA...` |

### Frontend Applications (`.env`)

| Application | Key | Description | Default |
|---|---|---|---|
| **Customer App** | `EXPO_PUBLIC_API_URL` | Base backend endpoint URL | `http://localhost:8000` |
| **Driver App** | `EXPO_PUBLIC_API_URL` | Base backend endpoint URL | `http://localhost:8000` |
| **Admin Web** | `VITE_API_BASE_URL` | Base backend endpoint URL | `http://localhost:8000` |
| **Facility Web** | `VITE_API_BASE_URL` | Base backend endpoint URL | `http://localhost:8000` |

---

## API Documentation

FastAPI automatically generates comprehensive OpenAPI documentation:
- **Interactive Swagger UI**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`
- **OpenAPI Schema**: `http://localhost:8000/openapi.json`

### Primary Endpoint Groups

- `/api/auth`: Login, registration, token refresh, and password management.
- `/api/pickups`: Customer pickup creation, tracking, invoices, OTP requests, and payments.
- `/api/driver/routes`: Driver assigned stops, stop arrival, weight entry, photo upload, and OTP verification.
- `/api/admin/route-optimization`: VRP optimizer trigger, multi-vehicle dispatch, and fleet metrics.
- `/api/admin/pickups`: Operations management, manual dispatch, exception review, and overrides.
- `/api/facility/disposal-shipments`: Inbound shipment intake, arrival weight reconciliation, and certificate upload.
- `/api/compliance`: Terms and privacy policies, consent management, DSR data export, and erasure requests.

---

## Testing & Quality Assurance

Pharmatrix enforces rigorous testing standards across backend business logic and frontend type safety.

### Running Backend Unit & Integration Tests

```bash
cd backend
.venv\Scripts\activate

# Run all automated test suites
pytest

# Run targeted compliance, payment, and route optimization tests
pytest tests/test_compliance_service.py tests/test_payment_hardening.py tests/test_route_optimizer_contract.py
```

### Running Frontend Typechecks & Builds

```bash
# Typecheck Customer App
cd frontend_customer && npx tsc --noEmit

# Typecheck Driver App
cd ../frontend_driver && npx tsc --noEmit

# Production Build Admin Portal
cd ../frontend_admin && npx tsc --noEmit && npx vite build

# Production Build Facility Portal
cd ../frontend_facility && npx tsc --noEmit && npx vite build
```

---

## Production Hardening & Deployment

Pharmatrix includes automated production safety checks built directly into the codebase:
1. **Zero Test Key Exposure**: `backend/app/core/config.py` validates that `RAZORPAY_KEY_ID` does not start with `rzp_test_*` when `APP_ENV=production`.
2. **CORS Hardening**: Wildcard (`*`) CORS origins cause immediate startup failure in production environments.
3. **Database Safeguards**: Prevents production execution pointing to `localhost` or SQLite databases.
4. **Seed Protection**: [seed_route_optimization_data.py](file:///c:/pharmatrix_dev/backend/seed_route_optimization_data.py) will refuse to run in production environments.
5. **Row Level Security (RLS)**: [supabase_rls_hardening.sql](file:///c:/pharmatrix_dev/backend/migrations/sql/supabase_rls_hardening.sql) enforces tenant isolation across 39 relational tables in Supabase.
6. **Compile-Time Tree Shaking**: Simulation buttons in the customer mobile app are wrapped in `{__DEV__ ? ... : null}` to prevent debug UI leakage in production APK/IPA bundles.

---

## Legal Documentation & Compliance Inventory

Comprehensive legal documents are maintained in the [`legal/`](file:///c:/pharmatrix_dev/legal/) directory:

| Document | File | Purpose |
|---|---|---|
| **Privacy Policy** | `01_privacy_policy.md` | DPDP Act 2023 & GDPR disclosures on collection and sharing |
| **Terms & Conditions** | `02_terms_and_conditions.md` | Customer platform terms, pickup procedures, liability limits |
| **Customer Agreement** | `03_customer_agreement.md` | B2B service agreement for distributors, stockists, pharmacies |
| **Driver Agreement** | `04_driver_agreement.md` | Hazardous waste transporter rules, chain of custody obligations |
| **Facility Agreement** | `05_facility_agreement.md` | Treatment facility intake, weight reconciliation, certification |
| **Data Retention Policy**| `06_data_retention_policy.md`| Data categories, statutory retention rules, deletion triggers |
| **DSR Procedure** | `07_data_deletion_and_dsr_procedure.md` | Data subject rights workflow (access, correction, erasure) |
| **Cookie & Tracking** | `08_cookie_and_tracking_policy.md`| Essential tokens vs. optional analytics tracking rules |
| **Marketing Consent** | `09_marketing_consent_policy.md`| Opt-in/opt-out rules for transactional vs. promotional SMS |
| **Breach Response** | `10_data_breach_response_plan.md`| Incident triage, 72-hour regulatory notification protocol |
| **Vendor Register** | `11_vendor_compliance_register.md`| Subprocessor audit (Supabase, Razorpay, Meta, AWS, OSRM) |
| **IP Checklist** | `12_ip_ownership_checklist.md`| Proprietary code, trade secrets, database rights, trademarks |
| **OSS Inventory** | `13_oss_licence_inventory.md`| Permissive license compliance (MIT, Apache 2.0, BSD) |
| **Regulatory Checklist**| `14_regulatory_compliance_checklist.md`| CDSCO May 2025 guidelines & Bio-Medical Waste Rules |
| **Refund Policy** | `15_payment_and_refund_policy.md`| Razorpay transaction settlement, dispute resolution, refunds |
| **Internal Access** | `16_internal_data_access_policy.md`| Principle of least privilege, RBAC access controls, audit logs |
| **Sanitization Report**| `17_phase_10_production_sanitization_report.md`| Phase 10 development cleanup and verification audit report |

---

## License

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or deployment of this repository, via any medium, is strictly prohibited without explicit written permission from the platform owners.

*Copyright © 2026 Pharmatrix. All rights reserved.*
