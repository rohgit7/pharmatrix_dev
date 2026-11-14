# PHARMATRIX PHARMACEUTICAL & BIOMEDICAL WASTE REGULATORY COMPLIANCE AUDIT

**Document Reference:** PMX-REG-BMW-2026  
**Version:** 1.0.0  
**Effective Date:** November 14, 2026  
**Status:** Environmental & Drug Regulatory Compliance Evaluation  

---

## 1. Executive Summary
This document provides an exhaustive regulatory applicability and compliance checklist for Pharmatrix's pharmaceutical waste collection, transportation, consolidation, and disposal operations across India.

### Core Finding on Legal Characterization:
Pharmatrix does not operate merely as a passive software SaaS provider. By dispatching drivers to physically collect pharmaceutical waste, operating an intermediate sorting warehouse, weighing consignments, and transferring consolidated loads to CBWTFs, **Pharmatrix operates as an Authorized Waste Collection Agency / Logistics Transporter / Intermediary Handler** under Indian environmental law.

Consequently, Pharmatrix must hold specific statutory authorizations and adhere to strict operational guidelines under:
1. **Bio-Medical Waste Management Rules, 2016 ("BMW Rules")** (notified under the Environment (Protection) Act, 1986);
2. **CPCB Revised Guidelines for Common Bio-medical Waste Treatment and Disposal Facilities (CBWTF)**;
3. **Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016** (where hazardous chemical pharmaceuticals are handled);
4. **Drugs and Cosmetics Act, 1940 and Drugs and Cosmetics Rules, 1945** (regarding expired drugs, non-diversion, and license verification);
5. **Motor Vehicles Act, 1988 & Central Motor Vehicles Rules, 1989** (Rules 129 to 137 regarding transportation of dangerous and hazardous goods).

---

## 2. Waste Stream Mapping & Segregation Audit

The Pharmatrix backend enforces waste categorization in `app/models/enums.py` and `app/api/pickups.py` matching Schedule I of the BMW Rules:

| Pharmatrix Code | Waste Type | CPCB Bin Color | Target Treatment Technology | Statutory Requirements & Packaging Mandate | Platform Status |
|---|---|---|---|---|---|
| `EXPIRED_DISCARDED_MEDICINE` | Outdated, expired, contaminated, or damaged pharmaceuticals | **Yellow** Non-chlorinated bag | High-temperature Incineration (>1050°C) or plasma pyrolysis | Barcoded yellow bags. Expired cytotoxic drugs must be sent to incineration or secured deep burial (if remote). | **Fully Implemented** |
| `CHEMICAL` / `CHEMICAL_LIQUID` | Solid/liquid chemical reagents, disinfectant residues, cytotoxic waste | **Yellow** Container | Incineration / specialized chemical effluent treatment | Double packaging with cytotoxic labels; leak-proof chemical carboys for liquid residues. | **Fully Implemented** |
| `CONTAMINATED_RECYCLABLE` | Contaminated plastics, IV bottles, tubing, syringes without needles | **Red** Non-chlorinated bag | Autoclaving/microwaving followed by shredding / recycling | Red plastic bag. No chlorinated plastics permitted under Rule 4(b). | **Fully Implemented** |
| `SHARPS` | Needles, syringes with fixed needles, scalpels, surgical blades | **White Translucent** Container | Autoclaving followed by shredding / encapsulation | Rigid, puncture-proof, tamper-proof, leak-proof containers. | **Fully Implemented** |
| `GLASSWARE` | Broken or intact medicine ampoules, vials, glassware | **Blue** Cardboard box / container | Disinfection / autoclaving followed by recycling | Puncture-resistant cardboard box with blue marking. | **Fully Implemented** |
| `HAZARDOUS_OTHER` | Miscellaneous hazardous biomedical / pharmaceutical byproducts | **Brown** Container | Specialized hazardous waste landfill / incineration | Brown labeled container conforming to hazardous waste packaging. | **Fully Implemented** |

---

## 3. Statutory Regulatory Requirements & Action Checklist

### 3.1 State Pollution Control Board (SPCB) Authorizations
- [ ] **Form III Application (Authorization for Handling Bio-Medical Waste):** Under Rule 10 of BMW Rules, 2016, any entity handling, collecting, transporting, or storing bio-medical waste must obtain formal written authorization from the relevant State Pollution Control Board (e.g., KSPCB in Karnataka, TNPCB in Tamil Nadu, MPCB in Maharashtra).
  - *Status:* **Action Required by Management.** Legal counsel must submit Form III applications for each operating state.
- [ ] **Consent to Establish (CTE) and Consent to Operate (CTO):** Required for the intermediate sorting warehouse under Section 25 of the Water Act, 1974 and Section 21 of the Air Act, 1981.
  - *Status:* **Action Required.** Must ensure intermediate warehouse facilities have active CTO approvals.

### 3.2 Vehicle Fitness and Dangerous Goods Carriage
- [ ] **Vehicle Marking & Labeling:** Under Rule 17 of the BMW Rules and Rule 130 of the Central Motor Vehicles Rules, 1989, vehicles used for transporting biomedical waste must display:
  - The international **Bio-hazard Symbol** prominently on all sides;
  - Emergency Information Panel (EIP) displaying emergency phone numbers and HAZCHEM codes.
- [ ] **Vehicle Tracking (GPS) & Online Reporting:** Vehicles must be equipped with GPS tracking devices linked to SPCB/CPCB tracking portals.
  - *Status:* **Technically Implemented in App** (`current_latitude`, `current_longitude` tracked in `Driver` model; can be streamed to SPCB API).
- [ ] **Driver HAZCHEM Endorsement:** Under Rule 9 of the Central Motor Vehicles Rules, drivers transporting dangerous or hazardous goods must have a special endorsement on their commercial driving license and complete a 3-day hazardous materials driving course.
  - *Status:* **Action Required in Operations.** Include HAZCHEM endorsement verification in driver onboarding.

### 3.3 Barcode and RFID Tracking System
- [ ] **CPCB Barcoding Standard:** Under Rule 4(r) of the BMW Rules, all waste containers must carry a CPCB-compliant Barcode/QR code label enabling tracking from generator to CBWTF.
  - *Status:* **Technically Implemented.** Pharmatrix generates unique `pickup_code`, `verification_token`, and printable QR codes linking the customer, location, date, and consignment batch.

### 3.4 Form II Manifest & Chain-of-Custody Documentation
- [ ] **Form II Waste Manifest:** A 5-copy or electronic manifest system documenting:
  - Copy 1: Generator copy (Customer retains upon handover);
  - Copy 2: Transporter copy (Driver/Pharmatrix retains);
  - Copy 3: Facility copy (CBWTF retains upon receipt);
  - Copy 4: Signed facility receipt returned to generator;
  - Copy 5: SPCB compliance copy.
  - *Status:* **Technically Implemented.** Digital Form II manifest workflow integrated across Customer App, Driver App, Warehouse Intake, and Facility Portal.

### 3.5 Drug Non-Diversion Under Drugs and Cosmetics Act
- [ ] **Prevention of Illicit Resale of Expired Medicines:** Expired drugs carry significant black-market diversion risks.
  - *Safeguards:*
    - Mandatory pharmacy drug license verification during onboarding;
    - Two-factor handover (Customer QR + 6-digit OTP);
    - Photographic evidence of collected sealed consignments on digital scales;
    - Weighbridge reconciliation between intermediate warehouse and CBWTF;
    - Final verified Disposal Certificates with certificate numbers issued by CBWTFs.

### 3.6 Record Maintenance & Annual Reporting
- [ ] **Rule 13 (Form IV Annual Report):** Every handling entity must compile an annual report of total waste collected, segregated, and handed over to CBWTFs, submitting it to the SPCB on or before **June 30** of each year.
  - *Status:* **Supported by Backend.** The database stores detailed records in `pickups`, `warehouse_intakes`, and `disposal_shipments` enabling automated Form IV annual report compilation.
- [ ] **5-Year Record Retention:** All collection logs, weigh slips, and manifests must be retained for at least 5 years.
  - *Status:* **Compliant.** Codified in Data Retention Policy.

