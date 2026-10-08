import { dbManager, Customer, Order, Payment, Refund, Product, Policy, SupportCase } from './db.js';

export interface StructuredError {
  is_error: true;
  category: 'validation' | 'not_found' | 'permission' | 'policy' | 'timeout' | 'unavailable';
  retryable: boolean;
  retry_after_ms: number | null;
  field: string | null;
  message: string;
}

export interface CaseState {
  customer_id: string | null;
  order_number: string | null;
  product_id: string | null;
  amount_zar: number | null;
  order_date: string | null;
  refund_type: string | null;
  refund_id: string | null;
  case_number: string | null;
  verified: boolean;
  attempts_left: number | null;
  customer_consent: boolean;
  human_approval_granted: boolean;
  failed_attempts_count: number;
}

export const INITIAL_CASE_STATE: CaseState = {
  customer_id: null,
  order_number: null,
  product_id: null,
  amount_zar: null,
  order_date: null,
  refund_type: null,
  refund_id: null,
  case_number: null,
  verified: false,
  attempts_left: 2,
  customer_consent: false,
  human_approval_granted: false,
  failed_attempts_count: 0,
};

const REFERENCE_DATE = '2026-10-05';

// In-memory idempotency cache alongside database persistence
const idempotencyStore: Map<string, { status: string; refund_id: string; amount_zar: number }> = new Map();

export class SupportTools {
  private env: 'work' | 'testing';

  constructor(env: 'work' | 'testing' = 'work') {
    this.env = env;
  }

  public setEnv(env: 'work' | 'testing') {
    this.env = env;
  }

  // Tool 1: get_customer
  public get_customer(
    customerId: string,
    caseState: CaseState
  ): { customer: Partial<Customer> } | StructuredError {
    if (!caseState.verified || caseState.customer_id !== customerId) {
      return {
        is_error: true,
        category: 'permission',
        retryable: false,
        retry_after_ms: null,
        field: 'customer_id',
        message: 'G1 Violation: Cannot access customer profile prior to successful identity verification.',
      };
    }

    const customers = dbManager.readTable<Customer>('customers', this.env);
    const customer = customers.find((c) => c.customer_id === customerId);

    if (!customer) {
      return {
        is_error: true,
        category: 'not_found',
        retryable: false,
        retry_after_ms: null,
        field: 'customer_id',
        message: `Customer ${customerId} not found in database.`,
      };
    }

    // Return permitted fields (G8 / POPIA compliance: masked phone)
    const sanitizedCustomer: Partial<Customer> = {
      customer_id: customer.customer_id,
      full_name: customer.full_name,
      email: customer.email,
      phone: `•••• •••• ${customer.verification_phone_last4}`,
      city: customer.city,
      province: customer.province,
      client_type: customer.client_type,
      company: customer.company,
      membership_status: customer.membership_status,
      account_status: customer.account_status,
      fraud_flag: customer.fraud_flag,
      verification_phone_last4: customer.verification_phone_last4,
      joined_date: customer.joined_date,
      open_cases: customer.open_cases,
    };

    return { customer: sanitizedCustomer };
  }

  // Tool 2: lookup_order
  public lookup_order(
    orderNumber: string,
    caseState: CaseState
  ):
    | {
        order: Order;
        product: Product | null;
        payments: Payment[];
        existing_refund: Refund | null;
      }
    | StructuredError {
    if (!orderNumber || !orderNumber.trim()) {
      return {
        is_error: true,
        category: 'validation',
        retryable: true,
        retry_after_ms: null,
        field: 'order_number',
        message: 'Order number is required and cannot be empty.',
      };
    }

    const orders = dbManager.readTable<Order>('orders', this.env);
    const order = orders.find((o) => o.order_number === orderNumber.trim());

    if (!order) {
      return {
        is_error: true,
        category: 'not_found',
        retryable: false,
        retry_after_ms: null,
        field: 'order_number',
        message: `Order ${orderNumber} does not exist in records.`,
      };
    }

    // Ownership check if customer is authenticated
    if (caseState.verified && caseState.customer_id && order.customer_id !== caseState.customer_id) {
      return {
        is_error: true,
        category: 'permission',
        retryable: false,
        retry_after_ms: null,
        field: 'order_number',
        message: 'G8 / Security Violation: Order does not belong to the verified customer.',
      };
    }

    const products = dbManager.readTable<Product>('products', this.env);
    const product = products.find((p) => p.product_id === order.product_id) || null;

    const payments = dbManager.readTable<Payment>('payments', this.env).filter((p) => p.order_number === orderNumber);
    const refunds = dbManager.readTable<Refund>('refunds', this.env);
    const existingRefund = refunds.find((r) => r.order_number === orderNumber) || null;

    return {
      order,
      product,
      payments,
      existing_refund: existingRefund,
    };
  }

  // Tool 3: verify_identity
  public verify_identity(
    email: string,
    phoneLast4: string,
    caseState: CaseState,
    customerIdHint?: string | null
  ):
    | {
        verified: boolean;
        attempts_left: number;
        customer_id?: string;
        message?: string;
      }
    | StructuredError {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone4 = (phoneLast4 || '').trim().replace(/\D/g, '').slice(-4);

    if (!cleanEmail || cleanPhone4.length !== 4) {
      return {
        is_error: true,
        category: 'validation',
        retryable: true,
        retry_after_ms: null,
        field: !cleanEmail ? 'email' : 'phone_last4',
        message: 'Verification requires both a valid registered email address and the last 4 digits of phone number.',
      };
    }

    const customers = dbManager.readTable<Customer>('customers', this.env);

    // Backend matching (G1: Do not reveal whether email exists prior to full match)
    const matchedCustomer = customers.find(
      (c) =>
        c.email.trim().toLowerCase() === cleanEmail &&
        c.verification_phone_last4.trim() === cleanPhone4 &&
        (!customerIdHint || c.customer_id === customerIdHint)
    );

    if (matchedCustomer) {
      return {
        verified: true,
        attempts_left: 2,
        customer_id: matchedCustomer.customer_id,
        message: 'Identity successfully verified against customer records.',
      };
    } else {
      const remaining = Math.max(0, (caseState.attempts_left ?? 2) - 1);
      return {
        verified: false,
        attempts_left: remaining,
        message:
          remaining > 0
            ? 'Identity verification failed. Information did not match records. 1 attempt remaining.'
            : 'Identity verification failed twice. Mandatory escalation required under Rule G1/G5.',
      };
    }
  }

  // Tool 4: check_refund_eligibility
  public check_refund_eligibility(
    orderNumber: string,
    refundType: 'order' | 'duplicate_charge',
    caseState: CaseState
  ):
    | {
        eligible: boolean;
        reason_code: string;
        amount_zar: number;
        needs_human_approval: boolean;
        policy_ids: string[];
        policy_explanation: string;
      }
    | StructuredError {
    if (!caseState.verified || !caseState.customer_id) {
      return {
        is_error: true,
        category: 'permission',
        retryable: false,
        retry_after_ms: null,
        field: 'verification',
        message: 'G1 Violation: Cannot evaluate refund eligibility before customer identity verification.',
      };
    }

    const orderRes = this.lookup_order(orderNumber, caseState);
    if ('is_error' in orderRes) {
      return orderRes;
    }

    const { order, product, payments, existing_refund } = orderRes;
    const customers = dbManager.readTable<Customer>('customers', this.env);
    const customer = customers.find((c) => c.customer_id === caseState.customer_id);

    if (!customer) {
      return {
        is_error: true,
        category: 'not_found',
        retryable: false,
        retry_after_ms: null,
        field: 'customer_id',
        message: 'Customer record missing.',
      };
    }

    // Rule 1: Fraud flag (POL-07, G5)
    if (customer.fraud_flag === 1) {
      return {
        eligible: false,
        reason_code: 'fraud_flagged_account',
        amount_zar: order.amount_zar,
        needs_human_approval: true,
        policy_ids: ['POL-07', 'G5'],
        policy_explanation: 'Account has a security restriction. Self-service automated refunds are blocked.',
      };
    }

    // Rule 2: Locked / Suspended account (POL-08, G5)
    if (customer.account_status === 'locked' || customer.account_status === 'suspended') {
      return {
        eligible: false,
        reason_code: 'account_locked_or_suspended',
        amount_zar: order.amount_zar,
        needs_human_approval: true,
        policy_ids: ['POL-08', 'G5'],
        policy_explanation: `Account is ${customer.account_status}. Automated changes and refunds are strictly prohibited.`,
      };
    }

    // Rule 3: Missing course access special handling
    if (order.delivery_status === 'pending_access') {
      return {
        eligible: false,
        reason_code: 'missing_course_access',
        amount_zar: order.amount_zar,
        needs_human_approval: true,
        policy_ids: ['G5'],
        policy_explanation: 'Course access has not been unlocked despite settled payment; requires operational fulfillment escalation.',
      };
    }

    // Rule 4: Duplicate charge specific logic (POL-09)
    if (refundType === 'duplicate_charge') {
      const settledPayments = payments.filter((p) => p.status === 'settled');
      if (settledPayments.length === 2) {
        const dupAmount = settledPayments[1].amount_zar;
        return {
          eligible: true,
          reason_code: 'duplicate_charge_verified',
          amount_zar: dupAmount,
          needs_human_approval: dupAmount > 5000,
          policy_ids: ['POL-09'],
          policy_explanation: 'Two settled payments confirmed for a single order. Duplicate charge is eligible for reversal.',
        };
      } else if (settledPayments.length > 2 || (settledPayments.length === 2 && settledPayments[0].amount_zar !== settledPayments[1].amount_zar)) {
        return {
          eligible: false,
          reason_code: 'conflicting_duplicate_data',
          amount_zar: order.amount_zar,
          needs_human_approval: true,
          policy_ids: ['POL-09', 'G5'],
          policy_explanation: 'Payment records conflict or contain complex anomalies; requires human billing escalation.',
        };
      } else {
        return {
          eligible: false,
          reason_code: 'no_duplicate_charge_found',
          amount_zar: 0,
          needs_human_approval: false,
          policy_ids: ['POL-09'],
          policy_explanation: 'Only one settled payment found on record. No duplicate transaction exists to refund.',
        };
      }
    }

    // Rule 5: Already refunded order (POL-03)
    if (order.refund_status === 'refunded' || existing_refund) {
      return {
        eligible: false,
        reason_code: 'already_refunded',
        amount_zar: order.amount_zar,
        needs_human_approval: false,
        policy_ids: ['POL-03'],
        policy_explanation: `Order ${orderNumber} has already been refunded under refund ID ${existing_refund?.refund_id || 'RF-PREVIOUS'}. Only one refund permitted per order.`,
      };
    }

    // Rule 6: Non-refundable product (POL-02)
    if (product && product.refundable === 0) {
      return {
        eligible: false,
        reason_code: 'non_refundable_product',
        amount_zar: order.amount_zar,
        needs_human_approval: false,
        policy_ids: ['POL-02'],
        policy_explanation: `Product ${product.name} is non-refundable (downloadable digital content once delivered).`,
      };
    }

    // Rule 7: Refund window evaluation (POL-01, POL-06)
    // Reference date: 2026-10-05
    const refDateMs = new Date(REFERENCE_DATE).getTime();
    const orderDateMs = new Date(order.order_date).getTime();
    const diffDays = Math.floor((refDateMs - orderDateMs) / (1000 * 60 * 60 * 24));

    if (product && product.is_subscription === 1) {
      if (diffDays > 14) {
        return {
          eligible: false,
          reason_code: 'subscription_window_expired',
          amount_zar: order.amount_zar,
          needs_human_approval: false,
          policy_ids: ['POL-06'],
          policy_explanation: `Subscription renewal occurred ${diffDays} days ago, exceeding the 14-day reversal limit.`,
        };
      }
    } else {
      if (diffDays > 14) {
        return {
          eligible: false,
          reason_code: 'refund_window_expired',
          amount_zar: order.amount_zar,
          needs_human_approval: false,
          policy_ids: ['POL-01'],
          policy_explanation: `Order date was ${order.order_date} (${diffDays} days ago). Refund window of 14 days has expired.`,
        };
      }
    }

    // Rule 8: Monetary threshold evaluation (POL-04, POL-05)
    if (order.amount_zar > 10000) {
      return {
        eligible: false,
        reason_code: 'hard_limit_exceeded',
        amount_zar: order.amount_zar,
        needs_human_approval: true,
        policy_ids: ['POL-05', 'G5'],
        policy_explanation: `Amount R${order.amount_zar.toLocaleString()} exceeds the R10,000 automated ceiling. Mandatory escalation to Support Lead.`,
      };
    }

    if (order.amount_zar > 5000) {
      return {
        eligible: true,
        reason_code: 'approval_limit_exceeded',
        amount_zar: order.amount_zar,
        needs_human_approval: true,
        policy_ids: ['POL-04'],
        policy_explanation: `Amount R${order.amount_zar.toLocaleString()} is within policy but exceeds R5,000, requiring Support Lead approval prior to execution.`,
      };
    }

    // Standard eligible refund
    return {
      eligible: true,
      reason_code: 'eligible',
      amount_zar: order.amount_zar,
      needs_human_approval: false,
      policy_ids: ['POL-01'],
      policy_explanation: `Order qualifies for standard full refund of R${order.amount_zar.toLocaleString()} within 14-day window.`,
    };
  }

  // Tool 5: process_refund
  public process_refund(
    orderNumber: string,
    refundType: 'order' | 'duplicate_charge',
    idempotencyKey: string,
    caseState: CaseState
  ):
    | {
        status: 'completed';
        refund_id: string;
        amount_zar: number;
        idempotency_key: string;
        message: string;
      }
    | StructuredError {
    const expectedKey = `${orderNumber}:${refundType}`;
    if (idempotencyKey !== expectedKey) {
      return {
        is_error: true,
        category: 'validation',
        retryable: false,
        retry_after_ms: null,
        field: 'idempotency_key',
        message: `Invalid idempotency key '${idempotencyKey}'. Format must be '${expectedKey}'.`,
      };
    }

    // Check existing idempotency record (prevent duplicate refund operations)
    if (idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey)!;
      return {
        status: 'completed',
        refund_id: cached.refund_id,
        amount_zar: cached.amount_zar,
        idempotency_key: idempotencyKey,
        message: 'Idempotent replay: Refund was already processed with this key.',
      };
    }

    // Verification check (G1, G4)
    if (!caseState.verified || !caseState.customer_id) {
      return {
        is_error: true,
        category: 'permission',
        retryable: false,
        retry_after_ms: null,
        field: 'verification',
        message: 'G4 Violation: Customer identity is not verified.',
      };
    }

    // Customer consent check (G4, Section 8 APPROVE step)
    if (!caseState.customer_consent) {
      return {
        is_error: true,
        category: 'permission',
        retryable: false,
        retry_after_ms: null,
        field: 'customer_consent',
        message: 'G4 Violation: Explicit customer confirmation is mandatory before executing a refund.',
      };
    }

    // Recheck eligibility in backend code (G4, Section 5)
    const eligRes = this.check_refund_eligibility(orderNumber, refundType, caseState);
    if ('is_error' in eligRes) {
      return eligRes;
    }

    if (!eligRes.eligible) {
      return {
        is_error: true,
        category: 'policy',
        retryable: false,
        retry_after_ms: null,
        field: 'policy',
        message: `Backend eligibility check failed: ${eligRes.policy_explanation}`,
      };
    }

    if (eligRes.needs_human_approval && !caseState.human_approval_granted) {
      return {
        is_error: true,
        category: 'policy',
        retryable: false,
        retry_after_ms: null,
        field: 'human_approval',
        message: 'G4/POL-04 Violation: This refund requires Support Lead human approval before execution.',
      };
    }

    // Section 8 EXECUTE step: 1. Create timestamped backup before financial write
    try {
      dbManager.createBackup(`refund_${orderNumber}`);
    } catch (err: any) {
      return {
        is_error: true,
        category: 'unavailable',
        retryable: true,
        retry_after_ms: 1000,
        field: 'backup',
        message: `Pre-write backup creation failed. Operation halted: ${err.message}`,
      };
    }

    // Section 8: Execute write to working database
    const refundId = `RF${700000 + Math.floor(1000 + Math.random() * 9000)}`;
    const refunds = dbManager.readTable<Refund>('refunds', this.env);

    // Double check database does not already contain refund for order
    const existing = refunds.find((r) => r.order_number === orderNumber && refundType === 'order');
    if (existing) {
      return {
        is_error: true,
        category: 'policy',
        retryable: false,
        retry_after_ms: null,
        field: 'refund_status',
        message: `Order ${orderNumber} is already refunded under ${existing.refund_id}.`,
      };
    }

    const newRefund: Refund = {
      refund_id: refundId,
      order_number: orderNumber,
      amount_zar: eligRes.amount_zar,
      created_date: REFERENCE_DATE,
      status: 'completed',
    };
    refunds.push(newRefund);
    dbManager.writeTable<Refund>('refunds', refunds, this.env);

    // Update order status if full order refund
    if (refundType === 'order') {
      const orders = dbManager.readTable<Order>('orders', this.env);
      const targetOrder = orders.find((o) => o.order_number === orderNumber);
      if (targetOrder) {
        targetOrder.refund_status = 'refunded';
        dbManager.writeTable<Order>('orders', orders, this.env);
      }
    }

    // Save in idempotency store
    idempotencyStore.set(idempotencyKey, {
      status: 'completed',
      refund_id: refundId,
      amount_zar: eligRes.amount_zar,
    });

    return {
      status: 'completed',
      refund_id: refundId,
      amount_zar: eligRes.amount_zar,
      idempotency_key: idempotencyKey,
      message: `Refund of R${eligRes.amount_zar.toLocaleString()} successfully processed.`,
    };
  }

  // Tool 6: escalate_to_human
  public escalate_to_human(
    reasonCode: string,
    customerId: string,
    orderNumber: string | null,
    summary: string,
    caseState: CaseState
  ):
    | {
        case_number: string;
        queue: string;
        expected_response_time: string;
        message: string;
      }
    | StructuredError {
    if (!reasonCode || !summary) {
      return {
        is_error: true,
        category: 'validation',
        retryable: true,
        retry_after_ms: null,
        field: 'reason_code',
        message: 'Escalation requires both a valid reason_code and descriptive summary.',
      };
    }

    // Determine target queue based on reasonCode and policies
    let queue = 'Support Lead Queue';
    let expectedTime = '24 hours';

    if (reasonCode.includes('fraud') || reasonCode.includes('security') || reasonCode.includes('unauthorized')) {
      queue = 'Security Queue';
      expectedTime = '1 hour';
    } else if (reasonCode.includes('locked') || reasonCode.includes('suspended') || reasonCode.includes('recovery')) {
      queue = 'Account Recovery Queue';
      expectedTime = '4 hours';
    } else if (reasonCode.includes('access') || reasonCode.includes('pending_access') || reasonCode.includes('lms')) {
      queue = 'Course Operations Queue';
      expectedTime = '4 hours';
    } else if (reasonCode.includes('duplicate') || reasonCode.includes('billing')) {
      queue = 'Billing & Payments Queue';
      expectedTime = '12 hours';
    } else if (reasonCode.includes('manager') || reasonCode.includes('legal') || reasonCode.includes('ombud')) {
      queue = 'Senior Support Leadership';
      expectedTime = '2 hours';
    } else if (reasonCode.includes('verification')) {
      queue = 'Customer Verification Desk';
      expectedTime = '24 hours';
    }

    const cases = dbManager.readTable<SupportCase>('support_cases', this.env);
    const caseNumber = `CS-${20000 + cases.length + Math.floor(Math.random() * 900)}`;

    const newCase: SupportCase = {
      case_number: caseNumber,
      customer_id: customerId || caseState.customer_id || 'UNKNOWN',
      opened_date: REFERENCE_DATE,
      category: reasonCode.split('_')[0] || 'escalation',
      status: 'open',
      summary: `[${queue}] ${summary} (Order: ${orderNumber || 'N/A'})`,
    };

    cases.push(newCase);
    dbManager.writeTable<SupportCase>('support_cases', cases, this.env);

    // Save escalation draft
    dbManager.saveDraft({
      case_number: caseNumber,
      customer_id: customerId || caseState.customer_id || 'UNKNOWN',
      order_number: orderNumber || undefined,
      summary,
      queue,
      status: 'submitted',
    });

    // Update customer open_cases
    const targetCustId = customerId || caseState.customer_id;
    if (targetCustId) {
      const customers = dbManager.readTable<Customer>('customers', this.env);
      const cust = customers.find((c) => c.customer_id === targetCustId);
      if (cust) {
        cust.open_cases = (cust.open_cases || 0) + 1;
        dbManager.writeTable<Customer>('customers', customers, this.env);
      }
    }

    return {
      case_number: caseNumber,
      queue,
      expected_response_time: expectedTime,
      message: `Case escalated to ${queue}. Reference number is ${caseNumber}. Expected response within ${expectedTime}.`,
    };
  }
}

export const toolsInstance = new SupportTools('work');
