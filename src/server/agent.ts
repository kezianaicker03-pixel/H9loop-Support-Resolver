import { SupportTools, CaseState, INITIAL_CASE_STATE } from './tools.js';
import { dbManager, AuditRecord, Policy } from './db.js';
import { GoogleGenAI } from '@google/genai';

export interface DecisionRecord {
  action: 'ask_question' | 'call_tool' | 'confirm_refund' | 'process_refund' | 'decline' | 'escalate' | 'close';
  rule_ids: string[];
  customer_id: string | null;
  order_number: string | null;
  amount_zar: number | null;
  reason_code: string | null;
  needs_human_approval: boolean;
}

export interface ConversationTurn {
  id: string;
  role: 'customer' | 'agent' | 'system';
  content: string;
  timestamp: string;
  tool_call?: {
    tool_name: string;
    inputs: any;
    output: any;
  };
  decision_record?: DecisionRecord;
  case_state?: CaseState;
}

export interface AgentResponse {
  message: string;
  decision: DecisionRecord;
  case_state: CaseState;
  tool_calls_executed: {
    tool_name: string;
    inputs: any;
    output: any;
  }[];
  error?: any;
}

export class SupportAgent {
  private tools: SupportTools;
  private env: 'work' | 'testing';
  private toolCallCount: number = 0;
  private consecutiveErrors: number = 0;
  private clarifyingQuestionsAsked: number = 0;
  private aiClient: GoogleGenAI | null = null;

  constructor(env: 'work' | 'testing' = 'work') {
    this.env = env;
    this.tools = new SupportTools(env);

    if (process.env.GEMINI_API_KEY) {
      try {
        this.aiClient = new GoogleGenAI();
      } catch (e) {
        console.warn('Google GenAI client initialization skipped or failed:', e);
      }
    }
  }

  public setEnv(env: 'work' | 'testing') {
    this.env = env;
    this.tools.setEnv(env);
  }

  // Load policies dynamically from policies.csv (G10: authoritative source)
  private getPolicies(): Policy[] {
    return dbManager.readTable<Policy>('policies', this.env);
  }

  // Validates Decision Record schema (Section 7)
  private validateDecision(decision: DecisionRecord): boolean {
    const validActions = ['ask_question', 'call_tool', 'confirm_refund', 'process_refund', 'decline', 'escalate', 'close'];
    if (!validActions.includes(decision.action)) return false;
    if (!Array.isArray(decision.rule_ids)) return false;
    if (typeof decision.needs_human_approval !== 'boolean') return false;
    return true;
  }

  // Format currency as R4,500.00 (G9)
  public static formatRand(amt: number | null | undefined): string {
    if (amt === null || amt === undefined) return 'R0.00';
    return `R${amt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // G9 word count enforcement: maximum 120 words
  public static enforceWordLimit(text: string): string {
    const words = text.trim().split(/\s+/);
    if (words.length <= 120) return text;
    return words.slice(0, 118).join(' ') + '...';
  }

  // Helper to extract email, phone, order number from natural text
  private extractEntities(text: string) {
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const orderMatch = text.match(/H9-\d{5}/i);
    // 4 consecutive digits that might be phone last 4
    const phone4Match = text.match(/\b\d{4}\b/);
    const hasLegalOrManager = /manager|lawyer|attorney|ombud|regulator|legal action|court|sue\b/i.test(text);
    const hasPartial = /partial refund|refund part|half refund|portion of|split refund/i.test(text);
    const isAngry = /furious|unacceptable|scam|ridiculous|terrible|horrible|angry|disgusted|worst/i.test(text);
    const isConfirmation = /\b(yes|confirm|proceed|i confirm|yes please|do it|approve)\b/i.test(text);
    const isDispute = /dispute|unjust|don't agree|not fair|fight this/i.test(text);
    const isDuplicate = /duplicate|charged twice|double charge|two times|billed twice/i.test(text);
    const isMissingAccess = /cannot access|no access|pending access|course locked|not unlocked|lms/i.test(text);

    return {
      email: emailMatch ? emailMatch[0].toLowerCase() : null,
      orderNumber: orderMatch ? orderMatch[0].toUpperCase() : null,
      phone4: phone4Match ? phone4Match[0] : null,
      hasLegalOrManager,
      hasPartial,
      isAngry,
      isConfirmation,
      isDispute,
      isDuplicate,
      isMissingAccess,
    };
  }

  // Record structured decision audit (Section 7)
  private logDecision(
    decision: DecisionRecord,
    caseState: CaseState,
    toolName?: string,
    toolInputs?: any,
    toolOutput?: any
  ): void {
    const isErr = toolOutput && 'is_error' in toolOutput && toolOutput.is_error === true;
    const auditRecord: AuditRecord = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      case_id: caseState.case_number,
      customer_id: caseState.customer_id,
      action: decision.action,
      rule_ids: decision.rule_ids,
      order_number: caseState.order_number || decision.order_number,
      amount_zar: caseState.amount_zar || decision.amount_zar,
      reason_code: decision.reason_code,
      needs_human_approval: decision.needs_human_approval,
      tool_name: toolName || null,
      tool_inputs: toolInputs || null,
      tool_output: toolOutput || null,
      is_error: isErr,
    };
    dbManager.recordAudit(auditRecord);
  }

  // Main orchestration turn: RECEIVE -> CLASSIFY -> VERIFY -> RETRIEVE -> CHECK POLICY -> DECIDE -> ACT -> RECORD -> RESPOND
  public async handleCustomerTurn(
    customerMessage: string,
    currentCaseState: CaseState,
    history: ConversationTurn[] = []
  ): Promise<AgentResponse> {
    const state: CaseState = { ...currentCaseState };
    const toolExecutions: { tool_name: string; inputs: any; output: any }[] = [];
    const entities = this.extractEntities(customerMessage);

    // Guard: Max 10 tool calls per conversation (Section 9)
    if (this.toolCallCount >= 10) {
      const escRes = this.tools.escalate_to_human(
        'max_tool_calls_exceeded',
        state.customer_id || 'UNKNOWN',
        state.order_number,
        'Conversation reached maximum 10 automated tool interactions.',
        state
      );
      state.case_number = 'case_number' in escRes ? escRes.case_number : 'CS-MAX';
      const dec: DecisionRecord = {
        action: 'escalate',
        rule_ids: ['G5', 'Section 9'],
        customer_id: state.customer_id,
        order_number: state.order_number,
        amount_zar: state.amount_zar,
        reason_code: 'max_tool_calls_exceeded',
        needs_human_approval: true,
      };
      this.logDecision(dec, state, 'escalate_to_human', {}, escRes);
      return {
        message: SupportAgent.enforceWordLimit(
          `Your case has been transferred to our Support Lead under reference ${state.case_number} for dedicated review. A specialist will follow up shortly.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: [{ tool_name: 'escalate_to_human', inputs: {}, output: escRes }],
      };
    }

    // G5: Immediate escalation check for manager / legal / ombud
    if (entities.hasLegalOrManager) {
      const escRes = this.tools.escalate_to_human(
        'manager_or_legal_requested',
        state.customer_id || 'UNKNOWN',
        state.order_number || entities.orderNumber,
        `Customer requested manager/legal intervention: "${customerMessage}"`,
        state
      );
      this.toolCallCount++;
      state.case_number = 'case_number' in escRes ? escRes.case_number : 'CS-LEGAL';
      const dec: DecisionRecord = {
        action: 'escalate',
        rule_ids: ['G5', 'POL-11'],
        customer_id: state.customer_id,
        order_number: state.order_number || entities.orderNumber,
        amount_zar: state.amount_zar,
        reason_code: 'manager_or_legal_requested',
        needs_human_approval: true,
      };
      this.logDecision(dec, state, 'escalate_to_human', { reason_code: 'manager_or_legal_requested' }, escRes);
      return {
        message: SupportAgent.enforceWordLimit(
          `I have escalated your file to Senior Support Leadership under reference ${state.case_number}. A senior manager will contact you within 2 hours.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: [{ tool_name: 'escalate_to_human', inputs: { reason: 'manager_or_legal_requested' }, output: escRes }],
      };
    }

    // G5: Partial refund request check (POL-13)
    if (entities.hasPartial) {
      const escRes = this.tools.escalate_to_human(
        'partial_refund_requested',
        state.customer_id || 'UNKNOWN',
        state.order_number || entities.orderNumber,
        `Customer requested partial refund: "${customerMessage}"`,
        state
      );
      this.toolCallCount++;
      state.case_number = 'case_number' in escRes ? escRes.case_number : 'CS-PARTIAL';
      const dec: DecisionRecord = {
        action: 'escalate',
        rule_ids: ['G5', 'POL-13'],
        customer_id: state.customer_id,
        order_number: state.order_number || entities.orderNumber,
        amount_zar: state.amount_zar,
        reason_code: 'partial_refund_requested',
        needs_human_approval: true,
      };
      this.logDecision(dec, state, 'escalate_to_human', { reason_code: 'partial_refund_requested' }, escRes);
      return {
        message: SupportAgent.enforceWordLimit(
          `Under H9loop policy POL-13, partial refunds require Support Lead evaluation. I have logged escalation case ${state.case_number} with your request. A team lead will review it within 24 hours.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: [{ tool_name: 'escalate_to_human', inputs: { reason: 'partial_refund_requested' }, output: escRes }],
      };
    }

    // G6: Tone handling prefix
    let tonePrefix = '';
    if (entities.isAngry) {
      tonePrefix = 'I understand your frustration and am committed to resolving your concern directly. ';
    }

    // Step 1: VERIFY (Rule G1, POL-10)
    // If not yet verified, check if customer supplied email and phone last 4
    if (!state.verified) {
      if (entities.email && entities.phone4) {
        this.toolCallCount++;
        const verifyRes = this.tools.verify_identity(entities.email, entities.phone4, state);
        toolExecutions.push({
          tool_name: 'verify_identity',
          inputs: { email: entities.email, phone_last4: entities.phone4 },
          output: verifyRes,
        });

        if ('is_error' in verifyRes) {
          this.consecutiveErrors++;
          const dec: DecisionRecord = {
            action: 'ask_question',
            rule_ids: ['G1', 'POL-10'],
            customer_id: null,
            order_number: entities.orderNumber || state.order_number,
            amount_zar: null,
            reason_code: 'verification_format_invalid',
            needs_human_approval: false,
          };
          this.logDecision(dec, state, 'verify_identity', { email: entities.email, phone_last4: entities.phone4 }, verifyRes);
          return {
            message: SupportAgent.enforceWordLimit(
              `${tonePrefix}Please provide your valid registered email address and the last 4 digits of your phone number for identity verification.`
            ),
            decision: dec,
            case_state: state,
            tool_calls_executed: toolExecutions,
          };
        }

        if (verifyRes.verified) {
          state.verified = true;
          state.customer_id = verifyRes.customer_id || null;
          state.attempts_left = 2;
          this.consecutiveErrors = 0;

          // Now retrieve verified customer profile (Tool 1: get_customer)
          this.toolCallCount++;
          const custRes = this.tools.get_customer(state.customer_id!, state);
          toolExecutions.push({
            tool_name: 'get_customer',
            inputs: { customer_id: state.customer_id },
            output: custRes,
          });

          if (!('is_error' in custRes)) {
            const customer = custRes.customer;

            // G5 & POL-07: Fraud flag check immediately upon customer profile load
            if (customer.fraud_flag === 1) {
              const escRes = this.tools.escalate_to_human(
                'fraud_flag_detected',
                state.customer_id!,
                entities.orderNumber || state.order_number,
                'Customer account has security fraud flag active (POL-07).',
                state
              );
              this.toolCallCount++;
              state.case_number = 'case_number' in escRes ? escRes.case_number : 'CS-SEC';
              const dec: DecisionRecord = {
                action: 'escalate',
                rule_ids: ['G5', 'POL-07'],
                customer_id: state.customer_id,
                order_number: state.order_number,
                amount_zar: state.amount_zar,
                reason_code: 'fraud_flag_detected',
                needs_human_approval: true,
              };
              this.logDecision(dec, state, 'escalate_to_human', { reason: 'fraud_flag_detected' }, escRes);
              return {
                message: SupportAgent.enforceWordLimit(
                  `Thank you for verifying your identity. Your enquiry has been routed to our Security Operations team under reference ${state.case_number} for specialist verification. A team member will assist you within 1 hour.`
                ),
                decision: dec,
                case_state: state,
                tool_calls_executed: toolExecutions,
              };
            }

            // G5 & POL-08: Locked or suspended account check
            if (customer.account_status === 'locked' || customer.account_status === 'suspended') {
              const escRes = this.tools.escalate_to_human(
                'account_locked_or_suspended',
                state.customer_id!,
                entities.orderNumber || state.order_number,
                `Customer account status is ${customer.account_status} (POL-08).`,
                state
              );
              this.toolCallCount++;
              state.case_number = 'case_number' in escRes ? escRes.case_number : 'CS-REC';
              const dec: DecisionRecord = {
                action: 'escalate',
                rule_ids: ['G5', 'POL-08'],
                customer_id: state.customer_id,
                order_number: state.order_number,
                amount_zar: state.amount_zar,
                reason_code: 'account_locked_or_suspended',
                needs_human_approval: true,
              };
              this.logDecision(dec, state, 'escalate_to_human', { reason: 'account_locked_or_suspended' }, escRes);
              return {
                message: SupportAgent.enforceWordLimit(
                  `Thank you for verifying. Your account is currently ${customer.account_status}. I have opened recovery case ${state.case_number} with our Account Recovery team, who will contact you within 4 hours.`
                ),
                decision: dec,
                case_state: state,
                tool_calls_executed: toolExecutions,
              };
            }
          }
        } else {
          // Verification failed
          state.failed_attempts_count = (state.failed_attempts_count || 0) + 1;
          state.attempts_left = verifyRes.attempts_left;

          if (state.attempts_left <= 0 || state.failed_attempts_count >= 2) {
            // Mandatory escalation under G1 & G5
            const escRes = this.tools.escalate_to_human(
              'verification_failed_twice',
              state.customer_id || 'UNKNOWN',
              entities.orderNumber || state.order_number,
              'Customer failed identity verification twice.',
              state
            );
            this.toolCallCount++;
            state.case_number = 'case_number' in escRes ? escRes.case_number : 'CS-VERIFY';
            const dec: DecisionRecord = {
              action: 'escalate',
              rule_ids: ['G1', 'G5'],
              customer_id: null,
              order_number: state.order_number,
              amount_zar: null,
              reason_code: 'verification_failed_twice',
              needs_human_approval: true,
            };
            this.logDecision(dec, state, 'escalate_to_human', { reason: 'verification_failed_twice' }, escRes);
            return {
              message: SupportAgent.enforceWordLimit(
                `Identity verification was unsuccessful. In accordance with POPIA security rules, your request has been escalated to our Verification Desk under reference ${state.case_number} for manual review.`
              ),
              decision: dec,
              case_state: state,
              tool_calls_executed: toolExecutions,
            };
          } else {
            const dec: DecisionRecord = {
              action: 'ask_question',
              rule_ids: ['G1', 'POL-10'],
              customer_id: null,
              order_number: entities.orderNumber || state.order_number,
              amount_zar: null,
              reason_code: 'verification_mismatch',
              needs_human_approval: false,
            };
            this.logDecision(dec, state, 'verify_identity', { email: entities.email, phone_last4: entities.phone4 }, verifyRes);
            return {
              message: SupportAgent.enforceWordLimit(
                `${tonePrefix}The email address or phone digits supplied do not match our records. You have 1 verification attempt remaining. Please confirm your registered email and the last 4 digits of your telephone number.`
              ),
              decision: dec,
              case_state: state,
              tool_calls_executed: toolExecutions,
            };
          }
        }
      } else {
        // Did not supply both factors
        const dec: DecisionRecord = {
          action: 'ask_question',
          rule_ids: ['G1', 'POL-10'],
          customer_id: null,
          order_number: entities.orderNumber || state.order_number,
          amount_zar: null,
          reason_code: 'awaiting_identity_verification',
          needs_human_approval: false,
        };
        this.logDecision(dec, state);
        return {
          message: SupportAgent.enforceWordLimit(
            `${tonePrefix}Before I can access your account details or assist with your enquiry, please verify your identity by providing your registered email address and the last 4 digits of your phone number.`
          ),
          decision: dec,
          case_state: state,
          tool_calls_executed: [],
        };
      }
    }

    // Step 2: RETRIEVE ORDER (Rule G7)
    const targetOrderNumber = entities.orderNumber || state.order_number;
    if (!targetOrderNumber) {
      const dec: DecisionRecord = {
        action: 'ask_question',
        rule_ids: ['G7'],
        customer_id: state.customer_id,
        order_number: null,
        amount_zar: null,
        reason_code: 'order_number_required',
        needs_human_approval: false,
      };
      this.logDecision(dec, state);
      return {
        message: SupportAgent.enforceWordLimit(
          `Your identity is verified. Please provide your order number (for example, H9-10159) so I can locate your purchase details.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: toolExecutions,
      };
    }

    state.order_number = targetOrderNumber;

    // Call lookup_order
    this.toolCallCount++;
    const orderLookup = this.tools.lookup_order(targetOrderNumber, state);
    toolExecutions.push({
      tool_name: 'lookup_order',
      inputs: { order_number: targetOrderNumber },
      output: orderLookup,
    });

    if ('is_error' in orderLookup) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors >= 2) {
        const escRes = this.tools.escalate_to_human(
          'two_consecutive_tool_failures',
          state.customer_id!,
          targetOrderNumber,
          `Consecutive tool failure on order lookup: ${orderLookup.message}`,
          state
        );
        state.case_number = 'case_number' in escRes ? escRes.case_number : 'CS-ERR';
        const dec: DecisionRecord = {
          action: 'escalate',
          rule_ids: ['G5'],
          customer_id: state.customer_id,
          order_number: targetOrderNumber,
          amount_zar: null,
          reason_code: 'two_consecutive_tool_failures',
          needs_human_approval: true,
        };
        this.logDecision(dec, state, 'escalate_to_human', {}, escRes);
        return {
          message: SupportAgent.enforceWordLimit(
            `We encountered a technical issue retrieving order ${targetOrderNumber}. Your case has been referred to support under reference ${state.case_number}.`
          ),
          decision: dec,
          case_state: state,
          tool_calls_executed: toolExecutions,
        };
      }
      const dec: DecisionRecord = {
        action: 'ask_question',
        rule_ids: ['G7'],
        customer_id: state.customer_id,
        order_number: null,
        amount_zar: null,
        reason_code: 'order_not_found',
        needs_human_approval: false,
      };
      this.logDecision(dec, state, 'lookup_order', { order_number: targetOrderNumber }, orderLookup);
      return {
        message: SupportAgent.enforceWordLimit(
          `We could not find order ${targetOrderNumber} linked to your verified account. Please check the order number and reply with the correct reference.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: toolExecutions,
      };
    }

    // Populate exact case block fields
    const { order, product, payments, existing_refund } = orderLookup;
    state.product_id = order.product_id;
    state.amount_zar = order.amount_zar;
    state.order_date = order.order_date;
    if (existing_refund) {
      state.refund_id = existing_refund.refund_id;
    }

    // Check if order delivery is pending_access (S10 missing access case)
    if (order.delivery_status === 'pending_access' || entities.isMissingAccess) {
      const escRes = this.tools.escalate_to_human(
        'missing_course_access',
        state.customer_id!,
        targetOrderNumber,
        `Payment settled on ${order.order_date} for ${product?.name || order.product_id}, but delivery status is pending_access.`,
        state
      );
      this.toolCallCount++;
      state.case_number = 'case_number' in escRes ? escRes.case_number : 'CS-ACCESS';
      const dec: DecisionRecord = {
        action: 'escalate',
        rule_ids: ['G5'],
        customer_id: state.customer_id,
        order_number: targetOrderNumber,
        amount_zar: state.amount_zar,
        reason_code: 'missing_course_access',
        needs_human_approval: true,
      };
      this.logDecision(dec, state, 'escalate_to_human', { reason: 'missing_course_access' }, escRes);
      return {
        message: SupportAgent.enforceWordLimit(
          `I verified your settled payment for ${product?.name || 'your course'} on order ${targetOrderNumber}. Access has not activated yet. I have escalated this to Course Operations under case ${state.case_number} to unlock your materials within 4 hours.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: toolExecutions,
      };
    }

    // Step 3: CHECK POLICY (Tool 4: check_refund_eligibility)
    const refundType = entities.isDuplicate || payments.filter((p) => p.status === 'settled').length === 2
      ? 'duplicate_charge'
      : 'order';
    state.refund_type = refundType;

    this.toolCallCount++;
    const eligRes = this.tools.check_refund_eligibility(targetOrderNumber, refundType, state);
    toolExecutions.push({
      tool_name: 'check_refund_eligibility',
      inputs: { order_number: targetOrderNumber, refund_type: refundType },
      output: eligRes,
    });

    if ('is_error' in eligRes) {
      this.consecutiveErrors++;
      const dec: DecisionRecord = {
        action: 'decline',
        rule_ids: ['G4'],
        customer_id: state.customer_id,
        order_number: targetOrderNumber,
        amount_zar: state.amount_zar,
        reason_code: 'eligibility_check_error',
        needs_human_approval: false,
      };
      this.logDecision(dec, state, 'check_refund_eligibility', {}, eligRes);
      return {
        message: SupportAgent.enforceWordLimit(
          `Could not determine refund eligibility: ${eligRes.message}`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: toolExecutions,
      };
    }

    // Scenario branches based on eligibility result
    // Branch A: Ineligible due to already refunded (S9)
    if (eligRes.reason_code === 'already_refunded') {
      const refundIdToQuote = state.refund_id || existing_refund?.refund_id || 'RF700000';
      const dec: DecisionRecord = {
        action: 'decline',
        rule_ids: ['POL-03'],
        customer_id: state.customer_id,
        order_number: targetOrderNumber,
        amount_zar: state.amount_zar,
        reason_code: 'already_refunded',
        needs_human_approval: false,
      };
      this.logDecision(dec, state, 'check_refund_eligibility', {}, eligRes);
      return {
        message: SupportAgent.enforceWordLimit(
          `Order ${targetOrderNumber} has already been refunded under refund reference ${refundIdToQuote}. Under H9loop policy POL-03, only one refund is permitted per order.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: toolExecutions,
      };
    }

    // Branch B: Ineligible due to non-refundable product (S3)
    if (eligRes.reason_code === 'non_refundable_product') {
      const dec: DecisionRecord = {
        action: 'decline',
        rule_ids: ['POL-02'],
        customer_id: state.customer_id,
        order_number: targetOrderNumber,
        amount_zar: state.amount_zar,
        reason_code: 'non_refundable_product',
        needs_human_approval: false,
      };
      this.logDecision(dec, state, 'check_refund_eligibility', {}, eligRes);
      return {
        message: SupportAgent.enforceWordLimit(
          `Order ${targetOrderNumber} for ${product?.name || 'digital download'} cannot be refunded. Under policy POL-02, downloadable digital packs are strictly non-refundable once delivered.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: toolExecutions,
      };
    }

    // Branch C: Ineligible due to expired refund window (S2, S8)
    if (eligRes.reason_code === 'refund_window_expired' || eligRes.reason_code === 'subscription_window_expired') {
      const polId = eligRes.reason_code === 'subscription_window_expired' ? 'POL-06' : 'POL-01';
      const dec: DecisionRecord = {
        action: 'decline',
        rule_ids: [polId],
        customer_id: state.customer_id,
        order_number: targetOrderNumber,
        amount_zar: state.amount_zar,
        reason_code: eligRes.reason_code,
        needs_human_approval: false,
      };
      this.logDecision(dec, state, 'check_refund_eligibility', {}, eligRes);
      return {
        message: SupportAgent.enforceWordLimit(
          `Refund request for order ${targetOrderNumber} is declined. Under policy ${polId}, refunds must be requested within 14 days of purchase. Your order was placed on ${order.order_date}, which is outside this window.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: toolExecutions,
      };
    }

    // Branch D: Hard escalation limit > R10,000 (S5, S6)
    if (eligRes.reason_code === 'hard_limit_exceeded') {
      const escRes = this.tools.escalate_to_human(
        'hard_limit_exceeded',
        state.customer_id!,
        targetOrderNumber,
        `Refund request of ${SupportAgent.formatRand(eligRes.amount_zar)} exceeds R10,000 ceiling (POL-05).`,
        state
      );
      this.toolCallCount++;
      state.case_number = 'case_number' in escRes ? escRes.case_number : 'CS-LIMIT';
      const dec: DecisionRecord = {
        action: 'escalate',
        rule_ids: ['G5', 'POL-05'],
        customer_id: state.customer_id,
        order_number: targetOrderNumber,
        amount_zar: eligRes.amount_zar,
        reason_code: 'hard_limit_exceeded',
        needs_human_approval: true,
      };
      this.logDecision(dec, state, 'escalate_to_human', { reason: 'hard_limit_exceeded' }, escRes);
      return {
        message: SupportAgent.enforceWordLimit(
          `Under policy POL-05, refunds exceeding R10,000.00 cannot be processed automatically. I have escalated your request for ${SupportAgent.formatRand(eligRes.amount_zar)} to the Support Lead under reference ${state.case_number} for review within 24 hours.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: toolExecutions,
      };
    }

    // Branch E: Human approval limit > R5,000 and <= R10,000 (POL-04)
    if (eligRes.needs_human_approval && eligRes.reason_code === 'approval_limit_exceeded') {
      const escRes = this.tools.escalate_to_human(
        'approval_limit_exceeded',
        state.customer_id!,
        targetOrderNumber,
        `Refund of ${SupportAgent.formatRand(eligRes.amount_zar)} exceeds R5,000 and requires Support Lead approval (POL-04).`,
        state
      );
      this.toolCallCount++;
      state.case_number = 'case_number' in escRes ? escRes.case_number : 'CS-APPR';
      const dec: DecisionRecord = {
        action: 'escalate',
        rule_ids: ['POL-04', 'G5'],
        customer_id: state.customer_id,
        order_number: targetOrderNumber,
        amount_zar: eligRes.amount_zar,
        reason_code: 'approval_limit_exceeded',
        needs_human_approval: true,
      };
      this.logDecision(dec, state, 'escalate_to_human', { reason: 'approval_limit_exceeded' }, escRes);
      return {
        message: SupportAgent.enforceWordLimit(
          `Under policy POL-04, refunds between R5,000.00 and R10,000.00 require Support Lead authorization. I have submitted escalation case ${state.case_number} for team lead review within 24 hours.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: toolExecutions,
      };
    }

    // Branch F: Eligible for automated refund (S1, S4 duplicate charge, S12 day 13, S13 day 14)
    if (eligRes.eligible && !eligRes.needs_human_approval) {
      // Section 8: APPROVE step
      // Has the customer given explicit consent?
      if (!entities.isConfirmation && !state.customer_consent) {
        const dec: DecisionRecord = {
          action: 'confirm_refund',
          rule_ids: ['G4', 'Section 8'],
          customer_id: state.customer_id,
          order_number: targetOrderNumber,
          amount_zar: eligRes.amount_zar,
          reason_code: null,
          needs_human_approval: false,
        };
        this.logDecision(dec, state);
        const refundDesc = refundType === 'duplicate_charge'
          ? `reversing one duplicate charge of ${SupportAgent.formatRand(eligRes.amount_zar)}`
          : `a full refund of ${SupportAgent.formatRand(eligRes.amount_zar)}`;

        return {
          message: SupportAgent.enforceWordLimit(
            `Order ${targetOrderNumber} is eligible for ${refundDesc} to your original payment method (${order.payment_method}). Processing takes 2-3 business days. Do you confirm that you want to proceed with this refund?`
          ),
          decision: dec,
          case_state: state,
          tool_calls_executed: toolExecutions,
        };
      }

      // Customer confirmed ("yes", "confirm", etc.) -> EXECUTE (Section 8)
      state.customer_consent = true;
      const idempotencyKey = `${targetOrderNumber}:${refundType}`;

      this.toolCallCount++;
      const procRes = this.tools.process_refund(targetOrderNumber, refundType, idempotencyKey, state);
      toolExecutions.push({
        tool_name: 'process_refund',
        inputs: {
          order_number: targetOrderNumber,
          refund_type: refundType,
          idempotency_key: idempotencyKey,
        },
        output: procRes,
      });

      if ('is_error' in procRes) {
        this.consecutiveErrors++;
        const dec: DecisionRecord = {
          action: 'escalate',
          rule_ids: ['G3', 'G5'],
          customer_id: state.customer_id,
          order_number: targetOrderNumber,
          amount_zar: eligRes.amount_zar,
          reason_code: 'refund_processing_failed',
          needs_human_approval: true,
        };
        this.logDecision(dec, state, 'process_refund', { idempotencyKey }, procRes);
        return {
          message: SupportAgent.enforceWordLimit(
            `We encountered an error processing your refund: ${procRes.message}. I have alerted human support to finalize your payment.`
          ),
          decision: dec,
          case_state: state,
          tool_calls_executed: toolExecutions,
        };
      }

      state.refund_id = procRes.refund_id;
      const dec: DecisionRecord = {
        action: 'close',
        rule_ids: ['G3', 'G4', 'Section 8'],
        customer_id: state.customer_id,
        order_number: targetOrderNumber,
        amount_zar: procRes.amount_zar,
        reason_code: 'refund_completed',
        needs_human_approval: false,
      };
      this.logDecision(dec, state, 'process_refund', { idempotencyKey }, procRes);

      const successDetail = refundType === 'duplicate_charge'
        ? `The duplicate charge of ${SupportAgent.formatRand(procRes.amount_zar)} on order ${targetOrderNumber} has been refunded.`
        : `Your refund of ${SupportAgent.formatRand(procRes.amount_zar)} for order ${targetOrderNumber} has been processed successfully.`;

      return {
        message: SupportAgent.enforceWordLimit(
          `${successDetail} Your refund confirmation reference is ${procRes.refund_id}. Funds will appear in your account within 2-3 business days.`
        ),
        decision: dec,
        case_state: state,
        tool_calls_executed: toolExecutions,
      };
    }

    // Default catch-all
    const defDec: DecisionRecord = {
      action: 'ask_question',
      rule_ids: ['G6'],
      customer_id: state.customer_id,
      order_number: state.order_number,
      amount_zar: state.amount_zar,
      reason_code: null,
      needs_human_approval: false,
    };
    this.logDecision(defDec, state);
    return {
      message: SupportAgent.enforceWordLimit(
        `${tonePrefix}How may I assist you further with your H9loop enquiry? Please let me know your question or order number.`
      ),
      decision: defDec,
      case_state: state,
      tool_calls_executed: toolExecutions,
    };
  }
}

export const agentInstance = new SupportAgent('work');
