# Skill: Refund Eligibility Assessment

## Objective
Evaluate whether a customer order or duplicate charge qualifies for a full automated refund under H9loop policies without modifying any database records.

## Procedure
1. Confirm identity verification status is `verified = true`.
2. Inspect order details using `lookup_order(order_number)`.
3. Check customer account status:
   - If `fraud_flag == 1` -> Reject self-service, trigger G5 escalation to Security queue.
   - If `account_status in ['locked', 'suspended']` -> Reject self-service, trigger G5 escalation to Account Recovery queue.
4. Check product properties:
   - If `refundable == 0` (e.g. digital downloads like P009) -> Ineligible under POL-02. Decline cleanly with explanation.
5. Check order refund status:
   - If `refund_status == 'refunded'` -> Ineligible under POL-03. Return existing `refund_id` from database.
6. Check time window:
   - For order refunds: Reference date is `2026-10-05`. If `(2026-10-05 - order_date) > 14 days`, ineligible under POL-01.
   - For subscriptions: If renewal date is older than 14 days, ineligible under POL-06.
   - If day 13 or day 14: Within window ($\le 14$ days), eligible.
7. Check monetary thresholds:
   - If `amount_zar > 10,000` -> Ineligible for automated processing under POL-05. Must escalate to Support Lead.
   - If `amount_zar > 5,000` -> Eligible in principle but requires human approval under POL-04 (`needs_human_approval = true`).
   - If `amount_zar <= 5,000` -> Eligible for automated processing without human approval.
8. Output structured eligibility verdict via `check_refund_eligibility`.
