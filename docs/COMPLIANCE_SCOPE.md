# Compliance Scope

This repository does not and cannot satisfy "all compliance regulations" by itself.

Compliance depends on the organization, deployment environment, data classification, contracts, policies, training, incident response, and legal interpretation. This codebase can provide technical evidence for selected controls, but it is not a legal certification package.

Sources checked on 2026-05-05:

- HIPAA Security Rule, HHS: https://www.hhs.gov/hipaa/for-professionals/security/index.html
- HIPAA Security Rule summary, HHS: https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html
- GDPR principles, European Commission: https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/principles-gdpr_en
- FDA medical device cybersecurity guidance, FDA: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cybersecurity-networked-medical-devices-containing-shelf-ots-software
- FDA medical device cybersecurity overview, FDA: https://www.fda.gov/medical-devices/digital-health-center-excellence/cybersecurity

## Honest Claim

Allowed claim:

> This project demonstrates privacy-governed remote monitoring analytics with differential privacy gates, role separation, runtime configuration checks, and tamper-evident audit evidence.

Forbidden claim:

> This project is HIPAA/GDPR/FDA compliant.

## Control Mapping

| Framework Area | What the Rule Cares About | Current Evidence | Status |
| --- | --- | --- | --- |
| HIPAA Security Rule | Administrative, physical, and technical safeguards for ePHI | Role checks, audit trail, runtime config checks, validation, rate limiting | Partial technical demo |
| HIPAA access control | Limit access to ePHI-like records | Patient/clinician role split; clinician-only DP release | Partial |
| HIPAA audit controls | Record and examine activity | SHA-256 audit chain; audit verification endpoint/script | Partial |
| HIPAA integrity | Protect data from improper alteration/destruction | Audit chain detects tampering with audit rows | Partial |
| GDPR data minimisation | Collect/process only what is necessary | Minimal score/time telemetry model; aggregate release pattern | Partial |
| GDPR purpose limitation | Process data for clear purposes | `PrivacyRelease.purpose` records release purpose | Partial |
| GDPR storage limitation | Retain data only as long as necessary | Not implemented yet | Gap |
| GDPR transparency/rights | Inform individuals and support data rights | Not implemented yet | Gap |
| GDPR integrity/confidentiality | Secure personal data | Role gates, validation, secrets checks, audit evidence | Partial |
| FDA cyber device expectations | Secure design, risk management, vulnerability handling, SBOM, lifecycle security | STRIDE threat model and secure-by-design docs | Early evidence only |
| FDA premarket submission content | Documentation for cybersecurity risk and controls | Not a SaMD submission package | Out of scope |

## What Would Be Needed for Real Compliance Work

HIPAA-oriented production work would need:

- covered-entity/business-associate determination
- policies and procedures
- workforce training
- access reviews
- business associate agreements
- incident-response and breach-notification process
- encryption and key-management design
- backup, disaster recovery, and availability controls
- operational audit review, not only audit storage

GDPR-oriented production work would need:

- lawful basis and consent/withdrawal flow
- data subject access, correction, deletion, and export workflows
- data protection impact assessment where required
- retention schedule and deletion jobs
- processor/controller contract analysis
- cross-border transfer assessment where applicable
- privacy notice and records of processing activities

FDA/SaMD-oriented production work would need:

- intended-use and risk classification analysis
- quality management system
- software requirements, traceability, and verification evidence
- cybersecurity risk management file
- SBOM
- vulnerability disclosure and patch process
- clinical validation if diagnostic/therapeutic claims are made

## Next Repo-Level Evidence to Add

1. Consent and retention models.
2. Evidence page mapping controls to code/tests.
3. SBOM generation and dependency review workflow.
4. Data export/deletion stubs for privacy-rights narratives.
5. CI gate that runs tests, build, Prisma validation, and audit-chain verification.
