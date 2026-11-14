# PHARMATRIX DATA BREACH AND SECURITY INCIDENT RESPONSE PLAN

**Document Reference:** PMX-SEC-IRP-2026  
**Version:** 1.0.0  
**Effective Date:** November 14, 2026  
**Status:** Approved for Security Operations Team Implementation  

---

## 1. Executive Summary & Statutory Framework
This Data Breach and Security Incident Response Plan ("**Plan**") defines the mandatory protocols for detecting, assessing, containing, investigating, and reporting security incidents and personal data breaches across the Pharmatrix infrastructure.

This Plan operates under strict statutory deadlines:
1. **CERT-In Cyber Security Directions (April 28, 2022):** Mandatory reporting of specified cyber incidents to the Indian Computer Emergency Response Team (CERT-In) within **6 hours** of notice.
2. **Digital Personal Data Protection Act, 2023 (Section 8(6)):** Mandatory notification of personal data breaches to the **Data Protection Board of India** and each affected Data Principal.
3. **General Data Protection Regulation (Art. 33 & 34 GDPR):** 72-hour notification to supervisory authorities where international data subjects are impacted.

---

## 2. Incident Classification Matrix

| Severity Level | Definition | Technical Indicators | Response Lead | Internal Escalation | Regulatory Reporting Required? |
|---|---|---|---|---|---|
| **Level 1 (P1 - Critical)** | Severe compromise of production database, unauthorized exfiltration of customer PII, leaked Supabase service role keys, or ransomware affecting dispatch. | Bulk extraction of customer or payment records; compromised database credentials; unauthorized admin user creation. | Chief Information Security Officer (CISO) & Lead Architect | CEO, CTO, Legal Counsel (Immediate within 30 min) | **YES:** CERT-In within 6 hours; DPB of India; affected users. |
| **Level 2 (P2 - High)** | Limited unauthorized access to specific customer files, unverified driver impersonation, or partial denial of service (DoS) on API. | Leaked short-lived storage signed URLs, credential stuffing against auth endpoints, webhook forgery attempts. | Security Operations Lead | Head of Engineering, Legal (Within 2 hours) | Evaluated by Legal Counsel based on risk of harm. |
| **Level 3 (P3 - Medium)** | Isolated account compromise, unauthorized local tampering with driver mobile app, failed brute-force attacks caught by rate limiter. | Multiple failed OTP attempts exceeding threshold; suspicious IP blacklisted; single compromised user password. | Application Security Engineer | DevOps Team (Within 12 hours) | Internal incident register only unless escalates. |
| **Level 4 (P4 - Low)** | Routine security events, port scans, benign vulnerability scanner traffic, minor software bugs with no data exposure. | Automated vulnerability scan blocked by firewall; invalid JWT token attempts. | Duty SRE / DevOps | Weekly Security Review | No. |

---

## 3. Incident Response Lifecycle (The 6-Phase Protocol)

```mermaid
flowchart LR
    P1["1. Detection & Triage"] --> P2["2. Immediate Containment"]
    P2 --> P3["3. Deep Investigation"]
    P3 --> P4["4. Statutory Notifications"]
    P4 --> P5["5. Eradication & Recovery"]
    P5 --> P6["6. Post-Mortem Review"]
```

### Phase 1: Detection & Triage (Hour 0)
- Automated alerts triggered from AWS CloudWatch, Supabase logs, or FastAPI error log bursts (`logger.exception`).
- Duty engineer immediately determines if personal data, database credentials, or API secrets are involved.
- Incident is logged in the internal Security Register with UTC timestamp.

### Phase 2: Immediate Containment (Hour 0 - 2)
- **Token Invalidation:** If JWT secret or Supabase service keys are compromised, immediately rotate secrets in `.env` and trigger global session invalidation.
- **Network Isolation:** Terminate compromised database connections; restrict affected IP ranges via AWS WAF or firewall rules.
- **Storage Protection:** Revoke active Supabase signed URLs; rotate storage bucket service keys.
- **Snapshot Preservation:** Take read-only forensic snapshots of database disks, system RAM, and server access logs (`/var/log/nginx`, `/var/log/fastapi`).

### Phase 3: Investigation & Impact Assessment (Hour 2 - 4)
- Forensic analysis of database query logs (`audit_logs`, PostgreSQL logs).
- Determine exact scope:
  - How many records were accessed/exfiltrated?
  - What categories of personal data were compromised (names, phone numbers, GPS coordinates, drug licenses)?
  - Were payment secrets involved? *(Note: Card data is not held by Pharmatrix; confirm Razorpay integration perimeter).*
  - What was the root cause (SQL injection, credential leak, dependency vulnerability)?

### Phase 4: Mandatory Statutory Notifications (Hour 4 - 6)

#### A. CERT-In Notification (Strict 6-Hour Deadline)
- Transmit formal Cyber Security Incident Report to `incident@cert-in.org.in` covering:
  - Incident type (e.g. Unauthorized access to IT systems/data);
  - Time of occurrence and time of detection;
  - Affected systems and technical impact;
  - Remedial measures implemented.

#### B. Data Protection Board of India (DPBI) Notification
- Submit formal notice pursuant to Section 8(6) of DPDPA 2023 detailing:
  - Nature and extent of personal data breach;
  - Estimated number of affected data principals;
  - Likely consequences and potential risk of harm;
  - Measures taken to mitigate risks;
  - Designated contact point for inquiries.

#### C. Affected Customer / User Notification
- If the breach entails a significant risk of harm to users (e.g., identity theft, operational disruption):
  - Send direct notification via registered email and push notifications.
  - Advise users on defensive actions (password reset, monitoring pharmacy orders).

### Phase 5: Eradication & Remediation (Day 1 - 3)
- Patch identified codebase or configuration vulnerabilities.
- Re-run automated vulnerability scans and dependency license/vulnerability audits.
- Verify integrity of restored database backups.

### Phase 6: Post-Incident Review & Report (Day 7)
- Convene a comprehensive post-mortem meeting with engineering, operations, and legal teams.
- Produce a formal Root Cause Analysis (RCA) document.
- Update technical controls, code review policies, and system monitoring thresholds.

---

## 4. Emergency Incident Response Contacts

- **Incident Commander:** Head of Technology (`incident@pharmatrix.com` / +91-80-4567-8901)
- **Legal & Regulatory Lead:** Corporate Legal Counsel (`legal@pharmatrix.com` / +91-80-4567-8902)
- **CERT-In Emergency Desk:** `incident@cert-in.org.in` / Phone: 1800-11-4949
- **Data Protection Board Helpdesk:** Contact details as notified by Ministry of Electronics and Information Technology (MeitY).

