import { describe, expect, it } from "vitest";

import { getAuditFieldChanges, parseAuditLogFilters } from "../../lib/audit/audit-log";

describe("parseAuditLogFilters", () => {
  it("normalizes supported filters and caps the page", () => {
    expect(
      parseAuditLogFilters({
        action: "update",
        page: "99999",
        record: "  profile-1  ",
        table: "profiles",
      }),
    ).toEqual({
      action: "UPDATE",
      page: 10_000,
      recordId: "profile-1",
      tableName: "profiles",
    });
  });

  it("drops malformed filters and restores the first page", () => {
    expect(
      parseAuditLogFilters({
        action: "export",
        page: "-2",
        record: " ",
        table: "profiles;drop table",
      }),
    ).toEqual({ page: 1 });
  });
});

describe("getAuditFieldChanges", () => {
  it("returns only meaningful changed fields in stable order", () => {
    expect(
      getAuditFieldChanges(
        { is_active: true, role: "teacher", updated_at: "before" },
        { is_active: false, role: "teacher", updated_at: "after" },
      ),
    ).toEqual([{ after: false, before: true, field: "is_active" }]);
  });

  it("handles insert and delete snapshots", () => {
    expect(getAuditFieldChanges(null, { id: "one", role: "student" })).toEqual([
      { after: "one", before: undefined, field: "id" },
      { after: "student", before: undefined, field: "role" },
    ]);
    expect(getAuditFieldChanges({ id: "one" }, null)).toEqual([
      { after: undefined, before: "one", field: "id" },
    ]);
  });
});
