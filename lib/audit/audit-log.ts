import type { Database, Json } from "@/types/database.types";

export const auditActions = ["INSERT", "UPDATE", "DELETE"] as const;

export type AuditAction = (typeof auditActions)[number];
export type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];

export type AuditLogFilters = {
  action?: AuditAction;
  page: number;
  recordId?: string;
  tableName?: string;
};

export type AuditFieldChange = {
  after: Json | undefined;
  before: Json | undefined;
  field: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

const auditActionSet = new Set<string>(auditActions);
const tableNamePattern = /^[a-z][a-z0-9_]{0,62}$/;

export function parseAuditLogFilters(params: SearchParams): AuditLogFilters {
  const action = firstValue(params.action)?.toUpperCase();
  const pageValue = Number.parseInt(firstValue(params.page) ?? "1", 10);
  const recordId = normalizeFilter(firstValue(params.record), 128);
  const tableNameCandidate = normalizeFilter(firstValue(params.table), 63);

  return {
    action: action && auditActionSet.has(action) ? (action as AuditAction) : undefined,
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 10_000) : 1,
    recordId,
    tableName:
      tableNameCandidate && tableNamePattern.test(tableNameCandidate)
        ? tableNameCandidate
        : undefined,
  };
}

export function getAuditFieldChanges(before: Json | null, after: Json | null): AuditFieldChange[] {
  const beforeRecord = asRecord(before);
  const afterRecord = asRecord(after);
  const fields = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);

  fields.delete("updated_at");

  return [...fields]
    .filter((field) => !jsonValuesEqual(beforeRecord[field], afterRecord[field]))
    .toSorted((left, right) => left.localeCompare(right))
    .map((field) => ({
      after: afterRecord[field],
      before: beforeRecord[field],
      field,
    }));
}

function asRecord(value: Json | null): Record<string, Json | undefined> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }

  return value;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeFilter(value: string | undefined, maxLength: number) {
  const normalized = value?.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function jsonValuesEqual(previous: Json | undefined, current: Json | undefined) {
  return JSON.stringify(previous) === JSON.stringify(current);
}
