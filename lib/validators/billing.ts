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
