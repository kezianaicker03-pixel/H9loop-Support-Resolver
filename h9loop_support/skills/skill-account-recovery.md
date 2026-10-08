# Skill: Account Recovery & Security Triage

## Objective
Safely handle customers with locked, suspended, or fraud-flagged accounts, and requests regarding missing course or LMS access.

## Procedure

### A. Locked or Suspended Accounts (POL-08, G5)
1. Complete identity verification or attempt verification.
2. If `get_customer` indicates `account_status == 'locked'` or `account_status == 'suspended'`:
   - Immediately cease self-service automated changes or refunds.
   - Do NOT execute any financial or data changes.
   - Escalate to `Account Recovery Queue` (`account_recovery`) with reason code `account_locked_or_suspended`.
   - Provide customer with escalation reference case number.

### B. Fraud-Flagged Accounts (POL-07, G5)
1. If `fraud_flag == 1`:
   - Cease self-service immediately.
   - Never reveal internal fraud status to customer (POPIA / Security rule G8).
   - Escalate directly to `Security Queue` (`security_ops`) with reason code `fraud_flag_detected`.
   - Provide standard security verification reference without disclosing internal risk metrics.

### C. Missing Course Access (Access Provisioning Issue)
1. Inspect order status via `lookup_order(order_number)`.
2. If `delivery_status == 'pending_access'` or enrollment has not activated:
   - Identify course product and delivery date.
   - Escalate immediately to `Course Operations Queue` (`course_operations`) with reason code `missing_course_access`.
   - Explain that Course Operations has been notified to unlock learning platform access.
