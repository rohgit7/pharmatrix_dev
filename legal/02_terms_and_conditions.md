# PHARMATRIX TERMS AND CONDITIONS OF SERVICE

**Document Version:** 1.0.0  
**Effective Date:** November 14, 2026  
**Last Updated:** November 14, 2026  
**Status:** Subject to Final Corporate & Legal Counsel Approval  

---

## 1. Acceptance of Terms and Nature of Agreement

These Terms and Conditions ("**Terms**") constitute a legally binding agreement between **Pharmatrix Technologies Private Limited** ("**Pharmatrix**", "**we**", "**us**", or "**our**") and the commercial entity or individual ("**Customer**", "**User**", or "**you**") accessing or using our software platform, APIs, mobile applications, and pharmaceutical logistics coordination services (the "**Platform**").

By registering an account, clicking "I Agree", scheduling a waste pickup, or using any component of the Platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms and our [Privacy Policy](file:///c:/pharmatrix_dev/legal/01_privacy_policy.md). If you do not agree to these Terms, you must not access or use the Platform.

---

## 2. Platform Role & Regulatory Status

### 2.1 Technology & Logistics Coordinator
Pharmatrix operates a digital B2B platform that coordinates the scheduling, tracking, chain-of-custody verification, and transportation of expired, discarded, or regulated pharmaceutical and clinical waste from licensed health establishments to authorized treatment and disposal facilities.

### 2.2 Not a Waste Generator or Final Disposal Facility
Pharmatrix is neither the generator of the waste nor the final treatment/disposal facility:
1. The **Customer** is and remains the **Waste Generator** under the **Bio-Medical Waste Management Rules, 2016** ("**BMW Rules**") and the **Environment (Protection) Act, 1986**.
2. Final treatment, autoclaving, shredding, and high-temperature incineration are performed exclusively by authorized **Common Bio-medical Waste Treatment Facilities ("CBWTFs")** holding valid Consents to Operate (CTO) from relevant State Pollution Control Boards.
3. Pharmatrix acts as the authorized logistics technology provider and certified collection intermediary ensuring statutory chain of custody, barcode tracking, and weight reconciliation.

---

## 3. Account Eligibility and Verification

### 3.1 Commercial Eligibility Only
The Platform is strictly a B2B enterprise platform. Only licensed healthcare facilities, pharmacies, hospitals, clinics, and pharmaceutical distributors operating legally in India are eligible to register as Customers.

### 3.2 Statutory Documentation Warranties
Upon registration, the Customer warrants and represents that:
1. It holds a valid **Drug Retail/Wholesale License** issued by the relevant State Drugs Control Administration under the **Drugs and Cosmetics Act, 1940** and Rules 1945 (Form 20, 21, 20B, 21B, or equivalent);
2. It holds valid authorizations and consents from the State Pollution Control Board where applicable;
3. All documents, GSTIN numbers, premises addresses, and contact credentials uploaded to the Platform are genuine, authentic, and current;
4. The individual creating the account is an authorized representative possessing corporate power to bind the business.

---

## 4. Waste Categories, Packaging, and Generator Responsibilities

### 4.1 Permitted Waste Streams
The Platform accepts pickup scheduling strictly for the following categorized pharmaceutical and clinical waste streams, coded in adherence with Schedule I of the BMW Rules, 2016:

1. **Yellow Bin / Bag (Code: `EXPIRED_DISCARDED_MEDICINE` / `CHEMICAL`):**
   - Outdated, contaminated, damaged, or discarded pharmaceuticals, tablets, capsules, syrups, and non-narcotic liquid formulations;
   - Cytotoxic and antineoplastic pharmaceutical waste (must be double-bagged in cytotoxic-labeled containers);
2. **Red Bin / Bag (Code: `CONTAMINATED_RECYCLABLE`):**
   - Contaminated plastic containers, IV tubes, syringes without needles, medicine bottles;
3. **White Translucent Container (Code: `SHARPS`):**
   - Contaminated sharps, scalpels, needles, ampoules (must be deposited in puncture-proof, tamper-proof, leak-proof containers);
4. **Blue Box / Container (Code: `GLASSWARE`):**
   - Contaminated medicine vials, broken ampoules, glass containers;
5. **Brown Container (Code: `HAZARDOUS_OTHER`):**
   - Other regulated solid hazardous pharmaceutical byproducts.

### 4.2 Prohibited Materials
Customers are strictly prohibited from submitting for collection:
1. **Radioactive Waste:** Any materials governed under the Atomic Energy Act, 1962;
2. **Explosives & Flammables:** Pressurized aerosol cans, volatile organic solvents, ammunition;
3. **Unregulated Municipal Trash:** General untreated cafeteria waste, municipal solid waste;
4. **Undisclosed Scheduled Narcotics:** Controlled substances under the NDPS Act, 1985 without prior statutory narcotics disposal permits and physical police verification certificates.

### 4.3 Packaging and Labeling Standard
The Customer warrants that all waste consignments handed to Pharmatrix drivers are:
- Securely packed in barcoded, non-chlorinated plastic bags or puncture-proof sharps boxes meeting CPCB specifications;
- Properly labeled with the Customer’s generated QR/Barcode code;
- Weighed prior to handover with estimated weight recorded in the Customer Mobile App.

---

## 5. Pickup Scheduling, Verification, and Handover

### 5.1 Scheduling and Routing
- Pickups must be scheduled via the Customer App at least 24 hours in advance, selecting an authorized time window (Morning: 09:00–12:00, Afternoon: 12:00–15:00, Evening: 15:00–18:00).
- Pharmatrix reserves the right to optimize routes and adjust driver arrival estimates based on traffic, emergency escalations, or weather constraints.

### 5.2 Strict Two-Factor Handover Verification
To guarantee chain of custody and prevent unauthorized collection or illicit diversion:
1. **Step 1 - QR Verification:** The driver must scan the customer’s secure physical or digital QR token to verify arrival at the geofenced address.
2. **Step 2 - Weight & Consignment Proof:** The driver weighs the consignment on a calibrated digital scale, records the weight in the Driver App, and captures a mandatory collection photograph showing the scale display and sealed container.
3. **Step 3 - OTP Verification:** The Customer’s authorized personnel must provide a unique 6-digit One-Time Password (OTP) displayed exclusively in the Customer App. The driver enters the OTP into the Driver App. Handover is finalized **only** upon successful cryptographic verification of the OTP.

### 5.3 Cancellation Policy
- Pickups may be cancelled through the Platform without charge up to **2 hours** prior to the start of the scheduled time window.
- Cancellations made when a driver is already en route or arrived at the premises may incur a nominal logistics call-out fee as specified in the Pricing Schedule.

---

## 6. Weight Discrepancies and Manifest Reconciliation

1. **Driver Recording:** The weight recorded by the driver at the point of collection using calibrated scales constitutes the primary handover weight (`collected_weight_kg`).
2. **Warehouse Intake Reconciliation:** Upon arrival at the Pharmatrix intermediate sorting warehouse, consignments are re-weighed. If the warehouse intake weight differs from the collected weight by more than **5%** or **0.5 kg** (whichever is higher), an automatic **Operational Discrepancy** is logged.
3. **Facility Acceptance:** The final weight recorded by the CBWTF upon receipt (`received_weight_kg`) is reflected in the official Form II manifest. In the event of an unexplained discrepancy, Pharmatrix operations will conduct an internal audit using photographic collection proofs.

---

## 7. Pricing, Invoicing, and Payment Terms

### 7.1 Dynamic & Tiered Pricing
Charges are computed based on:
- Base logistics pickup fee per visit;
- Weight charges per kilogram based on waste classification category (e.g., cytotoxic medicines incur specialized handling rates);
- Mandatory applicable statutory taxes, including Central GST (CGST) and State GST (SGST) or Integrated GST (IGST) at the prevailing statutory rates.

### 7.2 Invoicing & Payment
- Invoices are generated automatically upon successful pickup completion and weight verification.
- Payments must be settled through the Platform’s integrated payment gateway (Razorpay) via UPI, net banking, commercial debit/credit card, or approved corporate credit terms.
- Invoices not settled within the designated credit window (e.g., 15 days) may result in automatic suspension of subsequent pickup scheduling.

### 7.3 Refunds and Failed Transactions
- In the event of a duplicate payment or billing discrepancy confirmed by audit, refunds will be processed to the original payment source within **5–7 business days** via Razorpay.

---

## 8. Facility and Driver Obligations

### 8.1 Driver Standards
All drivers operating on the Platform are required to:
- Hold a valid commercial driving license;
- Complete mandatory training on hazardous materials handling, spill management, and personal protective equipment (PPE);
- Strictly adhere to vehicle speed limits, route adherence, and no-diversion protocols;
- Keep background GPS tracking enabled throughout their active duty shift.

### 8.2 Disposal Facility Standards
Partner CBWTF facilities covenant that:
- They maintain valid consents from the State Pollution Control Board;
- All waste received is incinerated, autoclaved, or shredded in accordance with CPCB emissions and treatment standards;
- Digitally signed Destruction/Disposal Certificates will be uploaded to the Platform within **48 hours** of waste processing.

---

## 9. Intellectual Property Rights

1. **Pharmatrix IP:** All software, mobile applications, algorithms (including the Pharmatrix dynamic route optimizer), database schemas, branding, logos, trademarks, and documentation are the exclusive intellectual property of Pharmatrix Technologies Private Limited.
2. **Limited License:** Customers and Drivers are granted a limited, revocable, non-exclusive, non-transferable license to access the Platform solely for lawful operational purposes in accordance with these Terms.
3. **Restrictions:** You shall not reverse engineer, decompile, disassemble, scrape, or extract source code from the Platform.

---

## 10. Prohibited Activities

Users agree not to:
1. Misrepresent non-hazardous waste as hazardous or vice-versa to manipulate pricing;
2. Hide restricted narcotics, radioactive substances, or unapproved biological agents within waste bins;
3. Collude with drivers to bypass scale weighing or OTP verification;
4. Interfere with the security, rate limiting, or backend integrity of the Platform APIs;
5. Attempt unauthorized access to other customers' manifests, certificates, or invoices.

---

## 11. Suspension and Termination

Pharmatrix reserves the right to immediately suspend or terminate access to the Platform without liability if:
1. A Customer’s drug retail or wholesale license is revoked or suspended by the regulatory authorities;
2. A Customer submits prohibited, hazardous, or dangerous substances without declaration;
3. Fraudulent weighing, fake document uploads, or payment defaults occur;
4. The Customer breaches any material term of this Agreement or applicable environmental laws.

---

## 12. Limitation of Liability and Indemnification

### 12.1 Limitation of Liability
To the maximum extent permitted by applicable law, Pharmatrix’s total aggregate liability arising out of or related to the Platform or these Terms, whether in contract, tort, or statutory duty, shall be limited to the total fees paid by the Customer to Pharmatrix in the **three (3) months** immediately preceding the event giving rise to liability.

Pharmatrix shall not be liable for any indirect, incidental, punitive, special, or consequential damages, including loss of profits, business disruption, or regulatory penalties incurred by the Customer due to improper waste segregation at source.

### 12.2 Customer Indemnity
The Customer agrees to indemnify, defend, and hold harmless Pharmatrix, its directors, officers, employees, and logistics agents against any claims, fines, liabilities, losses, damages, and legal costs arising from:
1. Customer’s failure to properly segregate, package, or label biomedical or pharmaceutical waste;
2. Submission of prohibited, explosive, or radioactive items;
3. Inaccurate, forged, or expired drug licenses or premises certifications;
4. Breach of environmental, pollution, or drug control laws by Customer personnel.

---

## 13. Dispute Resolution and Governing Law

1. **Governing Law:** These Terms shall be governed by, and construed in accordance with, the laws of the **Republic of India**, without regard to conflict of law principles.
2. **Amicable Settlement:** Any dispute, claim, or controversy arising out of these Terms shall first be referred to mutual good-faith negotiations between designated senior officers of both parties for a period of 30 days.
3. **Arbitration:** If unresolved, disputes shall be finally settled by binding arbitration in accordance with the **Arbitration and Conciliation Act, 1996**. The arbitration shall be conducted by a sole arbitrator mutually appointed by the parties. The seat and venue of arbitration shall be **Bangalore, Karnataka, India**. The language of arbitration shall be English.
4. **Court Jurisdiction:** Subject to arbitration, the competent courts at **Bangalore, Karnataka** shall have exclusive jurisdiction.

---

## 14. Contact and Grievance Officer

For inquiries, operational grievances, or notices under these Terms, please contact:

- **Legal & Compliance Officer:** Pharmatrix Technologies Private Limited
- **Address:** Level 4, Healthcare Logistics Tower, Whitefield, Bangalore, Karnataka – 560066, India
- **Email:** `legal@pharmatrix.com` / `compliance@pharmatrix.com`
- **Phone:** +91-80-4567-8900

