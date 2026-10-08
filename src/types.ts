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

export interface DecisionRecord {
  action: 'ask_question' | 'call_tool' | 'confirm_refund' | 'process_refund' | 'decline' | 'escalate' | 'close';
  rule_ids: string[];
  customer_id: string | null;
  order_number: string | null;
  amount_zar: number | null;
  reason_code: string | null;
  needs_human_approval: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'agent' | 'system';
  text: string;
  timestamp: string;
  toolCalls?: {
    tool_name: string;
    inputs: any;
    output: any;
  }[];
  decision?: DecisionRecord;
  caseState?: CaseState;
}

export interface ScenarioResult {
  scenarioId: string;
  name: string;
  orderNumber: string;
  expectedOutcome: string;
  actualOutcome: string;
  passed: boolean;
  outcomeType: 'resolved' | 'escalated' | 'declined';
  toolCalls: { tool_name: string; inputs: any; output: any }[];
  turns: { role: string; message: string }[];
  caseState: CaseState;
  decisionRecords: any[];
  policyCompliant: boolean;
  duplicateRefundsCount: number;
  notes: string;
}

export interface TestSuiteMetrics {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  fcrRate: number;
  correctEscalationRate: number;
  toolAccuracyRate: number;
  policyComplianceRate: number;
  duplicateRefunds: number;
  hallucinationRate: number;
  results: ScenarioResult[];
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  case_id: string | null;
  customer_id: string | null;
  action: string;
  rule_ids: string[];
  order_number?: string | null;
  amount_zar?: number | null;
  reason_code?: string | null;
  needs_human_approval?: boolean;
  tool_name?: string | null;
  tool_inputs?: any;
  tool_output?: any;
  is_error?: boolean;
}

export interface Policy {
  policy_id: string;
  topic: string;
  rule_text: string;
  threshold_zar: number | null;
  escalate: number;
}

export interface SupportCase {
  case_number: string;
  customer_id: string;
  opened_date: string;
  category: string;
  status: string;
  summary: string;
}
