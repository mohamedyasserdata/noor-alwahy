import { z } from "zod";

const moneySchema = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/);
const optionalMoneySchema = z.union([moneySchema, z.literal("")]);

export const packagePolicySchema = z.object({
  cancel_notice_hours: z.number().int().min(0).max(168),
  max_makeups_per_period: z.number().int().min(0).max(31),
  makeup_valid_days: z.number().int().min(0).max(365),
  late_tolerance_min: z.number().int().min(0).max(120),
  student_no_show_consumes_credit: z.boolean(),
  student_no_show_pays_teacher: z.boolean(),
  partial_refund_pct: z.number().min(0).max(100),
  max_pause_days: z.number().int().min(0).max(365),
  trial: z.object({ enabled: z.boolean(), price_pct: z.number().min(0).max(100) }),
});

export const packageFeatureSchema = z.object({
  ar: z.string().trim().min(2).max(160),
  en: z.string().trim().max(160).optional().default(""),
  icon: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,40}$/)
    .optional()
    .default("star"),
});

export const packagePriceSchema = z.object({
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  amount: moneySchema,
  min_amount: optionalMoneySchema.optional().default(""),
  max_amount: optionalMoneySchema.optional().default(""),
  is_active: z.boolean(),
  valid_from: z.iso.datetime({ offset: true }),
});

export const packageWizardSchema = z
  .object({
    package_id: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .default(""),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/),
    track_id: z.union([z.uuid(), z.literal("")]),
    name_ar: z.string().trim().min(2).max(160),
    name_en: z.string().trim().max(160).optional().default(""),
    description_ar: z.string().trim().max(4000).optional().default(""),
    description_en: z.string().trim().max(4000).optional().default(""),
    audience: z.enum(["child", "adult", "women"]),
    teacher_gender: z.enum(["male", "female", ""]),
    sessions_per_week: z.number().int().min(1).max(14),
    duration_min: z.number().int().min(10).max(120),
    billing_period: z.enum(["monthly", "quarterly", "yearly"]),
    features: z.array(packageFeatureSchema).max(12),
    policy: packagePolicySchema,
    prices: z.array(packagePriceSchema).min(1).max(23),
    is_published: z.boolean(),
  })
  .superRefine((value, context) => {
    const countries = new Set<string>();
    for (const [index, price] of value.prices.entries()) {
      if (countries.has(price.country_code)) {
        context.addIssue({
          code: "custom",
          message: "duplicate_country",
          path: ["prices", index, "country_code"],
        });
      }
      countries.add(price.country_code);
      const amount = Number(price.amount);
      if (price.min_amount && amount < Number(price.min_amount)) {
        context.addIssue({ code: "custom", message: "below_minimum", path: ["prices", index] });
      }
      if (price.max_amount && amount > Number(price.max_amount)) {
        context.addIssue({ code: "custom", message: "above_maximum", path: ["prices", index] });
      }
    }
    if (value.is_published) {
      const fallback = value.prices.find((price) => price.country_code === "ZZ");
      if (!fallback?.is_active) {
        context.addIssue({ code: "custom", message: "fallback_required", path: ["prices"] });
      }
    }
  });

export const packageIdSchema = z.uuid();
export const packageOrderSchema = z
  .array(z.uuid())
  .min(1)
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, "duplicate_package");

export type PackageWizardInput = z.infer<typeof packageWizardSchema>;
