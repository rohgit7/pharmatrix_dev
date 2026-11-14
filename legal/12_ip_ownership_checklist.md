# PHARMATRIX INTELLECTUAL PROPERTY (IP) OWNERSHIP CHECKLIST & AUDIT

**Document Reference:** PMX-IP-AUD-2026  
**Version:** 1.0.0  
**Effective Date:** November 14, 2026  
**Status:** IP Audit & Chain of Title Verification  

---

## 1. Executive Summary
This document provides an exhaustive inventory and chain-of-title review for all intellectual property assets associated with the Pharmatrix product. The purpose is to verify clean corporate ownership, eliminate risks of contributor/contractor copyright claims, audit brand trademark readiness, and identify third-party assets requiring licensing or attribution.

---

## 2. IP Asset Category Breakdown & Ownership Review

### 2.1 Software Source Code
| Codebase Component | Description | Primary Language / Stack | Creation Details | Ownership Assignment Status | Risk Level | Required Action |
|---|---|---|---|---|---|---|
| **FastAPI Backend** | Core REST APIs, auth, route optimizer, billing, webhooks | Python 3.10+, SQLAlchemy, FastAPI, Alembic | Developed by core engineering team | Proprietary code; requires written Invention Assignment / IP Assignment agreements signed by all contributors. | Medium | Execute Employee & Contractor Proprietary Information and Inventions Agreement (PIIA). |
| **Admin Dashboard** | Operations & dispatch management web app | TypeScript, React 18, Vite, TailwindCSS | Developed by frontend team | Proprietary code; covered under PIIA. | Low | Include PIIA coverage. |
| **Customer Mobile App** | B2B pickup ordering, OTP view, invoicing app | TypeScript, React Native, Expo | Developed by mobile engineering | Proprietary code; covered under PIIA. | Low | Include PIIA coverage. |
| **Driver Mobile App** | Route execution, weighing, QR scanner, proof upload | TypeScript, React Native, Expo | Developed by mobile engineering | Proprietary code; covered under PIIA. | Low | Include PIIA coverage. |
| **Facility Web Portal** | CBWTF receipt, weighing discrepancy, certificate upload | TypeScript, React 18, Vite | Developed by frontend team | Proprietary code; covered under PIIA. | Low | Include PIIA coverage. |

### 2.2 Proprietary Algorithms and Trade Secrets
| Algorithm / Workflow | Description | IP Protection Modality | Ownership Status | Recommended Protection |
|---|---|---|---|---|
| **Multi-Stop Route Optimizer** | Dynamic TSP/VRP route clustering, warehouse load allocation, vehicle capacity heuristics | Trade Secret / Proprietary Know-How | Solely owned by Pharmatrix Technologies Pvt Ltd | Strict non-disclosure agreements (NDAs) with engineers; protect as Trade Secret. |
| **Waste Bin Classification Engine** | Mapping biomedical and pharmaceutical waste streams to CPCB color bins and statutory disposal modes | Specialized Domain Logic / Trade Secret | Solely owned by Pharmatrix Technologies Pvt Ltd | Maintain internal documentation as confidential proprietary operational know-how. |

### 2.3 Brand, Trademarks, and Domain Names
| Asset | Current Status | Jurisdiction | Trademark Class | Legal Risk / Finding | Required Action |
|---|---|---|---|---|---|
| **"PHARMATRIX" (Wordmark)** | Unregistered / In Use | India | Class 39 (Transport, waste logistics) & Class 42 (SaaS technology) | **HIGH RISK:** Until formal trademark application is filed, third parties could register conflicting marks or assert passing off. | File formal trademark applications under Classes 39 & 42 with the Indian Trade Marks Registry immediately. |
| **Pharmatrix Logo / Device Mark** | Designed in-house | India | Class 39 & Class 42 | Unregistered device mark. | File device mark application along with designer assignment deed. |
| **Domain Names (`pharmatrix.com`, `pharmatrix.in`)** | Corporate registration | Global / India | N/A | Ensure domains are registered in the company's corporate entity name, not a personal developer email. | Verify WHOIS registrant is "Pharmatrix Technologies Private Limited". |

### 2.4 Third-Party Design Assets & Icons
| Asset Type | Third-Party Library | License Type | Compliance Finding |
|---|---|---|---|
| UI Icons (Web & Mobile) | `lucide-react`, `lucide-react-native`, `@expo/vector-icons` | ISC License / MIT License | Permissive commercial use permitted; no viral copyleft obligations. Attribution notice satisfied in open source credits. |
| Map Tiles (Dispatch UI) | Leaflet / OpenStreetMap | Open Database License (ODbL) / CC-BY-SA | Attribution ("© OpenStreetMap contributors") must be displayed in the map UI footer. Verified present in Leaflet default layer. |

---

## 3. IP Ownership Verification Checklist for Management

- [ ] **Founder / Early Contributor Assignment:** All code written prior to formal incorporation has been formally assigned to Pharmatrix Technologies Private Limited via a Deed of Assignment.
- [ ] **Employment & Contractor Agreements:** Standard PIIA clauses executed with 100% of software developers, product managers, and designers.
- [ ] **Designer Copyright Assignment:** External graphic designers have executed written assignments for logos, app icons, and branding collateral.
- [ ] **No Academic / Third-Party Employer Claim:** Contributors confirmed no code was developed using previous employers' equipment or confidential IP.
- [ ] **Trademark Application Filing:** Formal trademark registration filings initiated with the Controller General of Patents, Designs and Trade Marks (India).

