import { z } from "zod";
import { DateTime } from "luxon";

const country = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/);
const amount = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/);
const validFrom = z.string().transform((value, context) => {
  const parsed = DateTime.fromISO(value, { zone: value.endsWith("Z") ? undefined : "utc" }).toUTC();
  const iso = parsed.toISO();
  if (!parsed.isValid || !iso) {
    context.addIssue({ code: "custom", message: "invalid_datetime" });
    return z.NEVER;
  }
  return iso;
});

export const priceCellSchema = z.object({
  packageId: z.uuid(),
  countryCode: country,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  amount,
  validFrom,
});

export const pricingBulkSchema = z.object({
  sourceCountry: country,
  targetCountry: country,
  multiplier: z.coerce.number().positive().max(1000),
  roundTo: z.coerce.number().min(0.01).max(10000),
  validFrom,
  packageIds: z.array(z.uuid()).max(500).default([]),
});
