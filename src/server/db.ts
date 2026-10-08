import fs from 'fs';
import path from 'path';

export interface Customer {
  customer_id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  client_type: string;
  company: string;
  membership_status: string;
  account_status: string;
  fraud_flag: number;
  popia_marketing_consent: number;
  verification_phone_last4: string;
  joined_date: string;
  open_cases: number;
}

export interface Product {
  product_id: string;
  name: string;
  category: string;
  price_zar: number;
  is_digital: number;
  is_subscription: number;
  refundable: number;
}

export interface Order {
  order_number: string;
  customer_id: string;
  product_id: string;
  order_date: string;
  amount_zar: number;
  delivery_status: string;
  delivery_date: string;
  refund_window_ends: string;
  payment_method: string;
  refund_status: string;
  notes: string;
}

export interface Payment {
  transaction_id: string;
  order_number: string;
  customer_id: string;
  amount_zar: number;
  payment_date: string;
  status: string;
  method: string;
}

export interface Refund {
  refund_id: string;
  order_number: string;
  amount_zar: number;
  created_date: string;
  status: string;
}

export interface SupportCase {
  case_number: string;
  customer_id: string;
  opened_date: string;
  category: string;
  status: string;
  summary: string;
}

export interface Policy {
  policy_id: string;
  topic: string;
  rule_text: string;
  threshold_zar: number | null;
  escalate: number;
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
  notes?: string;
}

export class DatabaseManager {
  private baseDir: string;
  private origDir: string;
  private workDir: string;
  private testDir: string;
  private backupDir: string;
  private auditDir: string;
  private draftDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'h9loop_support');
    this.origDir = path.join(this.baseDir, 'data_original');
    this.workDir = path.join(this.baseDir, 'data_work');
    this.testDir = path.join(this.baseDir, 'testing');
    this.backupDir = path.join(this.baseDir, 'backups');
    this.auditDir = path.join(this.baseDir, 'audit_trail');
    this.draftDir = path.join(this.baseDir, 'drafts');

    [this.origDir, this.workDir, this.testDir, this.backupDir, this.auditDir, this.draftDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Helper to parse simple CSV with possible quotes
  private parseCSV(text: string): Record<string, string>[] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });
      rows.push(row);
    }
    return rows;
  }

  private serializeCSV(rows: Record<string, any>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const escapeVal = (v: any): string => {
      if (v === null || v === undefined) return '';
      const str = String(v);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.join(',');
    const dataLines = rows.map((r) => headers.map((h) => escapeVal(r[h])).join(','));
    return [headerLine, ...dataLines].join('\n') + '\n';
  }

  public getEnvDir(env: 'original' | 'work' | 'testing' = 'work'): string {
    if (env === 'original') return this.origDir;
    if (env === 'testing') return this.testDir;
    return this.workDir;
  }

  public readTable<T>(tableName: string, env: 'original' | 'work' | 'testing' = 'work'): T[] {
    const filePath = path.join(this.getEnvDir(env), `${tableName}.csv`);
    if (!fs.existsSync(filePath)) {
      // Fallback to original
      const origPath = path.join(this.origDir, `${tableName}.csv`);
      if (fs.existsSync(origPath)) {
        fs.copyFileSync(origPath, filePath);
      } else {
        return [];
      }
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = this.parseCSV(content);

    // Cast fields based on table
    return parsed.map((row) => {
      const res: any = { ...row };
      if (row.price_zar !== undefined) res.price_zar = parseFloat(row.price_zar) || 0;
      if (row.amount_zar !== undefined) res.amount_zar = parseFloat(row.amount_zar) || 0;
      if (row.threshold_zar !== undefined) res.threshold_zar = row.threshold_zar ? parseFloat(row.threshold_zar) : null;
      if (row.fraud_flag !== undefined) res.fraud_flag = parseInt(row.fraud_flag, 10) || 0;
      if (row.popia_marketing_consent !== undefined) res.popia_marketing_consent = parseInt(row.popia_marketing_consent, 10) || 0;
      if (row.open_cases !== undefined) res.open_cases = parseInt(row.open_cases, 10) || 0;
      if (row.is_digital !== undefined) res.is_digital = parseInt(row.is_digital, 10) || 0;
      if (row.is_subscription !== undefined) res.is_subscription = parseInt(row.is_subscription, 10) || 0;
      if (row.refundable !== undefined) res.refundable = parseInt(row.refundable, 10) || 0;
      if (row.escalate !== undefined) res.escalate = parseInt(row.escalate, 10) || 0;
      return res as T;
    });
  }

  public writeTable<T extends Record<string, any>>(tableName: string, rows: T[], env: 'work' | 'testing' = 'work'): void {
    if (env === ('original' as any)) {
      throw new Error('G2/Environment violation: data_original is strictly read-only!');
    }
    const filePath = path.join(this.getEnvDir(env), `${tableName}.csv`);
    const csvContent = this.serializeCSV(rows);
    fs.writeFileSync(filePath, csvContent, 'utf-8');
  }

  // Pre-write atomic backup (Mandatory under Section 8 & Section 11)
  public createBackup(tag: string = 'pre_write'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSubDir = path.join(this.backupDir, `backup_${tag}_${timestamp}`);
    fs.mkdirSync(backupSubDir, { recursive: true });

    const tables = ['customers', 'products', 'orders', 'payments', 'refunds', 'support_cases', 'policies'];
    for (const table of tables) {
      const src = path.join(this.workDir, `${table}.csv`);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(backupSubDir, `${table}.csv`));
      }
    }
    return backupSubDir;
  }

  // Reset work or test database to clean original records
  public resetData(target: 'work' | 'testing' | 'both' = 'both'): void {
    const targets = target === 'both' ? ['work', 'testing'] : [target];
    const tables = ['customers', 'products', 'orders', 'payments', 'refunds', 'support_cases', 'policies'];

    for (const tgt of targets) {
      const destDir = tgt === 'work' ? this.workDir : this.testDir;
      for (const table of tables) {
        const src = path.join(this.origDir, `${table}.csv`);
        const dest = path.join(destDir, `${table}.csv`);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }
    }
  }

  // Audit trail append
  public recordAudit(record: AuditRecord): void {
    const dateStr = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.auditDir, `audit_${dateStr}.jsonl`);
    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(logFile, line, 'utf-8');
  }

  public getAuditRecords(limit: number = 200, redact: boolean = true): AuditRecord[] {
    const records: AuditRecord[] = [];
    if (!fs.existsSync(this.auditDir)) return [];

    const files = fs.readdirSync(this.auditDir).filter((f) => f.endsWith('.jsonl')).sort().reverse();
    for (const file of files) {
      const filePath = path.join(this.auditDir, file);
      const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const rec: AuditRecord = JSON.parse(line);
          if (redact) {
            // POPIA redaction: no full emails or phone numbers
            if (rec.tool_inputs) {
              const sanitizedInputs = { ...rec.tool_inputs };
              if (sanitizedInputs.email) sanitizedInputs.email = '[REDACTED_POPIA]';
              if (sanitizedInputs.phone) sanitizedInputs.phone = `•••• ${sanitizedInputs.phone.slice(-4)}`;
              rec.tool_inputs = sanitizedInputs;
            }
          }
          records.push(rec);
          if (records.length >= limit) return records;
        } catch {
          // Ignore corrupt line
        }
      }
    }
    return records;
  }

  // Escalation draft persistence (Section 4 & Section 11)
  public saveDraft(draft: { case_number: string; customer_id: string; order_number?: string; summary: string; queue: string; status: 'draft' | 'submitted' }): void {
    const draftFile = path.join(this.draftDir, `${draft.case_number}.json`);
    fs.writeFileSync(draftFile, JSON.stringify(draft, null, 2), 'utf-8');
  }

  public getDrafts(): any[] {
    if (!fs.existsSync(this.draftDir)) return [];
    return fs.readdirSync(this.draftDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(this.draftDir, f), 'utf-8'));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
}

export const dbManager = new DatabaseManager();
