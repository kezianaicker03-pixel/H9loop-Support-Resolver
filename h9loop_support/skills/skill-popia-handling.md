# Skill: POPIA & Data Protection Compliance

## Objective
Enforce South African Protection of Personal Information Act (POPIA) compliance, confidentiality, and data minimization across all customer interactions.

## Mandatory Rules (G1, G8, POL-12)

1. **Two-Factor Pre-Disclosure Gate (G1, POL-10):**
   - No customer account, order, payment, or case history may be disclosed until BOTH email address and the last 4 digits of phone number have matched backend records.
   - Never reveal whether an email address exists in the database prior to complete verification.

2. **Data Minimization in Displays (G8, POL-12):**
   - Telephone numbers must ONLY be rendered as their last 4 digits (e.g. `•••• •••• 7500`).
   - Ordinary audit logs and exports must redact full email addresses and phone numbers.
   - Passwords, credit card PAN numbers, and national identity numbers must NEVER be requested or logged.

3. **Confidentiality of Internal Signals (G8):**
   - Internal fraud scores, fraud flags, risk flags, and administrative notes must never be disclosed to customers.
   - When an account is fraud-flagged or locked, state that an account specialist has been assigned to assist them.

4. **Session Isolation:**
   - Case context blocks and conversation states must remain strictly isolated between different sessions and users.
