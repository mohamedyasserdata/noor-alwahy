import { z } from "zod";

const amount = z
  .string()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/)
  .refine((value) => Number(value) > 0);

export const recordPaymentSchema = z.object({
  invoiceId: z.uuid(),
  kind: z.enum(["payment", "refund"]),
  amount,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  paymentMethodId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
  proofNote: z.string().trim().max(3000).optional().default(""),
});

export const paymentDecisionSchema = z.object({
  paymentId: z.uuid(),
  decision: z.enum(["confirmed", "rejected"]),
});

const detailValue = z.string().trim().max(300).optional().default("");
export const paymentMethodSchema = z.object({
  id: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  type: z.enum(["bank", "wallet", "instapay", "cash", "other"]),
  labelAr: z.string().trim().min(2).max(160),
  labelEn: z.string().trim().max(160).optional().default(""),
  accountName: detailValue,
  accountNumber: detailValue,
  iban: detailValue,
  phone: detailValue,
  branch: detailValue,
  referenceHint: detailValue,
  instructionsAr: z.string().trim().max(3000).optional().default(""),
  instructionsEn: z.string().trim().max(3000).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(10000),
});

export const paymentMethodToggleSchema = z.object({
  id: z.uuid(),
  isActive: z.enum(["true", "false"]),
});

export const expenseSchema = z.object({
  category: z.enum([
    "teacher_payout",
    "marketing",
    "software",
    "bank_fees",
    "rent",
    "equipment",
    "other",
  ]),
  description: z.string().trim().min(2).max(500),
  amount,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  incurredOn: z.iso.date(),
  payee: z.string().trim().max(200).optional().default(""),
  reference: z.string().trim().max(200).optional().default(""),
});

export const voidExpenseSchema = z.object({
  expenseId: z.uuid(),
  reason: z.string().trim().min(2).max(500),
});
