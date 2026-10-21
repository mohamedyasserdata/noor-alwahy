import { describe, expect, it } from "vitest";

import { createReceiptHtml } from "../../lib/billing/receipt-pdf";
import {
  paymentDecisionSchema,
  paymentMethodSchema,
  recordPaymentSchema,
} from "../../lib/validators/billing";

const payment = {
  invoiceId: "10000000-0000-4000-8000-000000000001",
  kind: "payment",
  amount: "900.00",
  currency: "EGP",
  paymentMethodId: "",
  proofNote: "Transfer reference 123",
};

describe("billing validation and receipt", () => {
  it("accepts a bounded manual payment and rejects invalid money", () => {
    expect(recordPaymentSchema.safeParse(payment).success).toBe(true);
    expect(recordPaymentSchema.safeParse({ ...payment, amount: "-1" }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...payment, currency: "egp" }).success).toBe(true);
  });

  it("allows only final review decisions", () => {
    expect(
      paymentDecisionSchema.safeParse({ paymentId: payment.invoiceId, decision: "confirmed" })
        .success,
    ).toBe(true);
    expect(
      paymentDecisionSchema.safeParse({
        paymentId: payment.invoiceId,
        decision: "pending_confirmation",
      }).success,
    ).toBe(false);
  });

  it("accepts bounded payment method details and rejects unsupported countries", () => {
    const method = {
      id: "",
      countryCode: "EG",
      type: "bank",
      labelAr: "حساب الأكاديمية",
      labelEn: "Academy account",
      accountName: "Noor Al-Wahy",
      accountNumber: "123456",
      iban: "EG000000000000",
      phone: "",
      branch: "Cairo",
      referenceHint: "Use the invoice number",
      instructionsAr: "اكتب رقم الفاتورة في المرجع",
      instructionsEn: "Use the invoice number as reference",
      sortOrder: 0,
    };
    expect(paymentMethodSchema.safeParse(method).success).toBe(true);
    expect(paymentMethodSchema.safeParse({ ...method, countryCode: "EGY" }).success).toBe(false);
  });

  it("renders a self-contained RTL receipt without external requests", async () => {
    const html = await createReceiptHtml({
      locale: "ar",
      receiptNo: "REC-2026-000001",
      invoiceNo: "INV-2026-000001",
      studentName: "طالب نور الوحي",
      kind: "payment",
      amount: "900.00",
      currency: "EGP",
      method: "تحويل بنكي",
      paidAt: "2026-10-21T10:00:00Z",
      confirmedAt: "2026-10-21T10:05:00Z",
    });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("REC-2026-000001");
    expect(html).toContain("طالب نور الوحي");
    expect(html).toContain("data:font/woff2;base64,");
    expect(html).not.toMatch(/https?:\/\//);
  });
});
