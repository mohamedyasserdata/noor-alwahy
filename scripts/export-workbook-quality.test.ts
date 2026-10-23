import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("export workbook quality", () => {
  it("creates valid financial and payout workbook packages", async () => {
    const { createFinancialWorkbook } = await import("@/lib/billing/financial-export");
    const { createPayoutWorkbook } = await import("@/lib/payouts/export");

    const financial = unzipSync(
      createFinancialWorkbook(
        [
          {
            currency: "EGP",
            invoiced: 1200,
            received: 900,
            refunded: 0,
            expenses: 200,
            outstanding: 300,
            netCash: 700,
          },
        ],
        "ar",
      ),
    );
    expect(Object.keys(financial)).toContain("xl/worksheets/sheet1.xml");
    expect(strFromU8(financial["xl/worksheets/sheet1.xml"]!)).toContain("EGP");

    const payout = unzipSync(
      createPayoutWorkbook({
        locale: "en",
        payoutNo: "PAY-1",
        teacher: '=WEBSERVICE("https://invalid.test")',
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        currency: "EGP",
        gross: 350,
        bonuses: 0,
        deductions: 0,
        net: 350,
        status: "approved",
        items: [{ date: "2026-10-01", kind: "@unsafe", rate: 350, amount: 350 }],
        adjustments: [],
      }),
    );
    const payoutSheet = strFromU8(payout["xl/worksheets/sheet1.xml"]!);
    expect(payoutSheet).toContain("<t>'@unsafe</t>");
    expect(payoutSheet).not.toContain("><t>@unsafe</t>");
  });

  it("protects formula-like values in advanced report workbooks", async () => {
    const { createAdvancedReportWorkbook } =
      await import("@/lib/control-center/advanced-export-renderers");
    const workbook = unzipSync(
      createAdvancedReportWorkbook(
        {
          report_type: "students",
          page: 1,
          page_size: 50,
          total: 1,
          rows: [{ student_no: "NW-1", full_name: '=WEBSERVICE("https://invalid.test")' }],
          currency_totals: [],
          filters: {},
          refreshed_at: "2026-10-23T18:00:00.000Z",
        },
        {
          reportType: "students",
          locale: "en",
          timezone: "Africa/Cairo",
          columns: ["student_no", "full_name"],
          filters: {},
          generatedAt: "2026-10-23T18:00:00.000Z",
        },
      ),
    );
    const sheet = strFromU8(workbook["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain("&apos;=WEBSERVICE");
    expect(Object.keys(workbook)).toContain("xl/worksheets/sheet2.xml");
  });
});
