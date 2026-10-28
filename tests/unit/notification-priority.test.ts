import { describe, expect, it } from "vitest";

import { notificationPriority } from "../../lib/notifications/priority";

describe("parent notification priority", () => {
  it("orders schedule, absence, invoice, report, then announcement", () => {
    const types = [
      "announcement",
      "report_approved",
      "invoice_due",
      "student_absence",
      "schedule_changed",
    ];
    expect(
      types.sort((left, right) => notificationPriority(left) - notificationPriority(right)),
    ).toEqual([
      "schedule_changed",
      "student_absence",
      "invoice_due",
      "report_approved",
      "announcement",
    ]);
  });
});
