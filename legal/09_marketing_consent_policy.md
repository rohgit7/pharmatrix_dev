# PHARMATRIX MARKETING AND COMMUNICATIONS CONSENT POLICY

**Document Version:** 1.0.0  
**Effective Date:** November 14, 2026  
**Status:** Approved for Implementation  

---

## 1. Principles of Commercial Communication
Pharmatrix operates under strict compliance with the **Digital Personal Data Protection Act, 2023 ("DPDPA")**, the **Telecom Commercial Communications Customer Preference Regulations, 2018 ("TCCCPR")** issued by TRAI (Telecom Regulatory Authority of India), and the **Information Technology Act, 2000**.

We maintain a strict separation between:
1. **Essential Transactional & Operational Communications:** Non-promotional, legally and contractually necessary updates regarding waste pickups, verification codes, driver arrival, safety alerts, and billing receipts.
2. **Promotional & Marketing Communications:** Optional announcements regarding new service regions, regulatory updates, feature launches, promotional discounts, or company newsletters.

---

## 2. Classification of Communications

| Message Category | Channels Used | Examples | Consent Requirement | Opt-Out Permitted? |
|---|---|---|---|---|
| **Critical Transactional** | SMS, Push, WhatsApp, Email | 6-digit Handover OTP, Driver Arrived at Location, Consignment Weighed, Route Delay Escalation. | Implicit under Contractual Necessity (Art. 7 DPDPA) | **No** (Essential for physical safety & waste chain-of-custody). |
| **Financial & Regulatory** | Email, In-App, WhatsApp | Tax Invoice generated, Payment Receipt, Form II Manifest, SPCB Destruction Certificate ready. | Contractual & Legal Obligation (BMW Rules & GST Act) | **No** (Mandatory compliance records). |
| **Educational & Regulatory Alerts** | Email, In-App Banners | Changes to State Pollution Control Board guidelines, upcoming holiday collection schedules. | Legitimate Interest / User Notice | **Yes** (User can mute non-critical alerts). |
| **Commercial / Promotional** | Email, WhatsApp, Push | Referral discounts, new waste category processing, seasonal promotions. | **Explicit, Freely-Given Opt-In Consent** | **Yes, at any time** (Immediate effect). |

---

## 3. Explicit Consent Capture and Preference Management

### 3.1 Unbundled Consent at Registration
- Acceptance of the [Terms and Conditions](file:///c:/pharmatrix_dev/legal/02_terms_and_conditions.md) and [Privacy Policy](file:///c:/pharmatrix_dev/legal/01_privacy_policy.md) is mandatory to use the Platform.
- **Promotional communications require a distinct, unbundled opt-in checkbox** that is unchecked by default.
- Using essential waste collection services is **never** conditional upon agreeing to promotional messaging.

### 3.2 Granular Multi-Channel Preferences
Users can control communication preferences per channel (`Email`, `SMS`, `WhatsApp`, `Push Notifications`) via the **Communication Preferences** API:
- `GET /api/compliance/marketing-preferences`
- `PUT /api/compliance/marketing-preferences`

### 3.3 Immediate Opt-Out & Unsubscribe
- Every promotional email contains a clear, one-click unsubscribe link in the footer.
- WhatsApp marketing templates include an explicit opt-out quick reply button ("Stop Promotions").
- Upon receipt of an opt-out request, the backend immediately updates the `marketing_preferences` record, blocking promotional message dispatch across that channel within 24 hours.

---

## 4. Third-Party Messaging Providers Configuration
1. **WhatsApp Business API:** Meta / WhatsApp Cloud API integration is configured strictly using approved message templates. Promotional templates are registered under the MARKETING category with TRAI Principal Entity DLT registration.
2. **Push Notifications:** Handled via Expo Push Notification service. Promotional push alerts check `marketing_preferences.push_promotions == True` before queuing.
3. **Email (SMTP):** Promotional emails are routed with valid DKIM, SPF, and DMARC authentication records to prevent spoofing and ensure clean deliverability.

