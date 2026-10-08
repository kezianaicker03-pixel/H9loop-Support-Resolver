# Skill: Billing Dispute Resolution

## Objective
Handle billing inquiries, duplicate charges, unexpected transaction amounts, and partial refund requests in accordance with POL-09 and POL-13.

## Procedure

### A. Duplicate Charge Handling (POL-09)
1. Verify customer identity via `verify_identity`.
2. Inspect payment records using `lookup_order(order_number)`.
3. Filter payments where `status == 'settled'`.
4. If exactly two settled payments exist for the same order:
   - Identify the duplicate charge payment transaction.
   - Evaluate eligibility with `check_refund_eligibility(order_number, 'duplicate_charge')`.
   - Present details to customer and ask for explicit confirmation:
     "Do you confirm that you want to proceed with this refund of R[amount] for the duplicate charge on order [order_number]?"
   - Upon explicit yes, execute `process_refund(order_number, 'duplicate_charge', idempotency_key)`.
5. If more or less than two settled payments exist, or payment amounts conflict:
   - Do not guess or process.
   - Escalate immediately to Billing Operations under G5.

### B. Partial Refund Requests (POL-13)
1. If the customer requests a partial refund or discount return:
   - Agent is strictly prohibited from executing partial refunds.
   - Capture customer requested amount and rationale.
   - Escalate case to Support Lead queue via `escalate_to_human(reason_code="partial_refund_requested", ...)`.
   - Inform customer that the Support Lead will review their partial refund request.
