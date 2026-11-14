# PHARMATRIX PAYMENT, BILLING AND REFUND POLICY

**Document Reference:** PMX-FIN-POL-2026  
**Version:** 1.0.0  
**Effective Date:** November 14, 2026  
**Status:** Approved for Commercial Operations  

---

## 1. Scope & Pricing Transparency
This Payment, Billing and Refund Policy ("**Policy**") governs all financial transactions, charges, invoices, and refunds executed through the Pharmatrix Platform between **Pharmatrix Technologies Private Limited** ("**Pharmatrix**") and registered commercial healthcare Customers.

Pharmatrix commits to **full pricing transparency**:
- All base logistics pickup rates and per-kilogram waste disposal charges are explicitly presented to the customer prior to scheduling or upon pickup confirmation.
- No hidden, arbitrary, or surprise surcharges are added.
- All invoices display an itemized breakdown of base fee, tiered weight charges, minimum weight threshold charges (if applicable), and statutory taxes.

---

## 2. Invoicing, Billing Calculations, and GST

### 2.1 Billing Calculation Workflow
1. **Initial Estimate:** When requesting a pickup, the customer enters an estimated weight, generating an estimated cost preview.
2. **Actual Measurement:** The definitive billable weight is established by the driver using calibrated digital scales during physical collection (`collected_weight_kg`).
3. **Automated Invoice Generation:** Upon physical collection completion, the backend generates an official tax invoice (`Invoice` model in `invoices` table) linked to the customer's active Pricing Plan (`PricingPlan` and `CustomerPricingAssignment`).
4. **GST Breakdown:** Invoices explicitly break down:
   - Taxable Service Value (HSN/SAC Code: 999432 - Hazardous and Bio-medical Waste Management Services);
   - CGST and SGST (for intra-state service provision) or IGST (for inter-state transactions) at the statutory GST rate (standard 18%).
   - Customer's registered GSTIN number for input tax credit (ITC) claims.

---

## 3. Online Payments & Razorpay Security Architecture

### 3.1 Razorpay Payment Gateway Integration
- All online electronic payments are processed through **Razorpay Software Private Limited**, an RBI-authorized Payment Aggregator.
- **Accepted Modes:** UPI (Google Pay, PhonePe, Paytm, BHIM), Net Banking across all major scheduled banks, Commercial Corporate Credit Cards, and Debit Cards.
- **Card Security & PCI-DSS:** Pharmatrix does **not** collect, store, or process raw credit card numbers, CVV codes, or net banking passwords. All card data is tokenized directly within Razorpay's PCI-DSS Level 1 compliant secure checkout sheet.

### 3.2 Backend Cryptographic Verification & Idempotency
To prevent duplicate charges, fraud, or network drop discrepancies:
1. **Idempotency Keys:** Every Razorpay order creation request enforces a unique `Idempotency-Key` header (`RazorpayOrder.idempotency_key`), guaranteeing that network retries never generate duplicate charges.
2. **HMAC-SHA256 Webhook Verification:** The Razorpay webhook handler (`/api/webhooks/razorpay`) validates the cryptographic `X-Razorpay-Signature` against `RAZORPAY_WEBHOOK_SECRET` before crediting invoice payments.

---

## 4. Cancellation and Failed Transaction Policies

### 4.1 Pickup Cancellations
- **Free Cancellation:** Customers may cancel a scheduled pickup without charge up to **2 hours** prior to the start of the scheduled collection window.
- **Late Cancellation / Driver Dispatched:** If cancelled after a driver has been dispatched or has arrived at the premises, a nominal dispatch call-out charge (as defined in the customer's pricing agreement) may be billed to compensate logistics operating costs.

### 4.2 Failed Transactions & Payment Drops
- If funds are deducted from a customer's bank account or UPI handle during a failed or timed-out session, Razorpay's automated clearing reconciliation will refund the debited amount back to the customer's source account within **5 to 7 banking days**.

---

## 5. Refunds and Dispute Resolution

### 5.1 Grounds for Refund
Customers may claim a refund or billing credit under the following verified circumstances:
1. **Duplicate Payment:** Accidentally paying the same invoice twice via different channels.
2. **Weight Measurement Discrepancy:** A verified calibration error or recorded discrepancy between driver scale weight and subsequent warehouse check.
3. **Failed Collection:** Payment was processed in advance but Pharmatrix was unable to service the pickup due to operational or vehicle failure.

### 5.2 Refund Claim Procedure
- To initiate a refund claim, the customer must submit a request within **7 business days** of invoice issuance via the in-app support portal or by emailing `billing@pharmatrix.com` quoting the `Invoice Code` and `Razorpay Payment ID`.
- Approved refunds are credited directly to the original payment source via Razorpay within **5 to 7 business days**.

---

## 6. Financial Records Retention
In compliance with Section 36 of the Central Goods and Services Tax Act, 2017 and the Income Tax Act, 1961, all invoices, credit notes, payment receipts, and webhook logs are securely preserved for **8 years** in cold encrypted storage.

