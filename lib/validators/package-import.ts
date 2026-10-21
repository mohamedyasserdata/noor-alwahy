import { packageWizardSchema, type PackageWizardInput } from "./packages";

export const packageImportHeaders = [
  "slug",
  "name_ar",
  "name_en",
  "description_ar",
  "description_en",
  "track_code",
  "audience",
  "teacher_gender",
  "sessions_per_week",
  "duration_min",
  "billing_period",
  "features_ar",
  "features_en",
  "cancel_notice_hours",
  "max_makeups_per_period",
  "makeup_valid_days",
  "late_tolerance_min",
  "student_no_show_consumes_credit",
  "student_no_show_pays_teacher",
  "partial_refund_pct",
  "max_pause_days",
  "trial_enabled",
  "trial_price_pct",
  "country_code",
  "currency",
  "amount",
  "min_amount",
  "max_amount",
  "is_active",
  "is_published",
] as const;

export type PackageImportError = { row: number; column: string; code: string };

type References = {
  tracks: Array<{ id: string; code: string }>;
  countries: Array<{ code: string; currency: string }>;
  packages: Array<{ id: string; slug: string }>;
  validFrom: string;
};

export function validatePackageImportRows(rows: string[][], references: References) {
  const errors: PackageImportError[] = [];
  const grouped = new Map<string, { firstRow: number; base: string; value: PackageWizardInput }>();

  rows.forEach((cells, index) => {
    const row = index + 2;
    const values = Object.fromEntries(
      packageImportHeaders.map((header, column) => [header, (cells[column] ?? "").trim()]),
    ) as Record<(typeof packageImportHeaders)[number], string>;
    const slug = values.slug.toLowerCase();
    const track = values.track_code
      ? references.tracks.find(
          (item) => item.code.toLowerCase() === values.track_code.toLowerCase(),
        )
      : null;
    const country = references.countries.find(
      (item) => item.code === values.country_code.toUpperCase(),
    );
    if (values.track_code && !track)
      errors.push({ row, column: "track_code", code: "unknown_track" });
    if (!country) errors.push({ row, column: "country_code", code: "unknown_country" });
    if (country && country.currency !== values.currency.toUpperCase()) {
      errors.push({ row, column: "currency", code: "currency_mismatch" });
    }

    const featuresAr = splitFeatures(values.features_ar);
    const featuresEn = splitFeatures(values.features_en);
    const desiredPublished = booleanValue(values.is_published);
    const candidate = {
      package_id: references.packages.find((item) => item.slug === slug)?.id ?? "",
      slug,
      track_id: track?.id ?? "",
      name_ar: values.name_ar,
      name_en: values.name_en,
      description_ar: values.description_ar,
      description_en: values.description_en,
      audience: values.audience,
      teacher_gender: values.teacher_gender,
      sessions_per_week: numberValue(values.sessions_per_week),
      duration_min: numberValue(values.duration_min),
      billing_period: values.billing_period,
      features: featuresAr.map((ar, featureIndex) => ({
        ar,
        en: featuresEn[featureIndex] ?? "",
        icon: "star",
      })),
      policy: {
        cancel_notice_hours: numberValue(values.cancel_notice_hours),
        max_makeups_per_period: numberValue(values.max_makeups_per_period),
        makeup_valid_days: numberValue(values.makeup_valid_days),
        late_tolerance_min: numberValue(values.late_tolerance_min),
        student_no_show_consumes_credit: booleanValue(values.student_no_show_consumes_credit),
        student_no_show_pays_teacher: booleanValue(values.student_no_show_pays_teacher),
        partial_refund_pct: numberValue(values.partial_refund_pct),
        max_pause_days: numberValue(values.max_pause_days),
        trial: {
          enabled: booleanValue(values.trial_enabled),
          price_pct: numberValue(values.trial_price_pct),
        },
      },
      prices: [
        {
          country_code: values.country_code,
          currency: values.currency,
          amount: values.amount,
          min_amount: values.min_amount,
          max_amount: values.max_amount,
          is_active: booleanValue(values.is_active),
          valid_from: references.validFrom,
        },
      ],
      is_published: false,
    };
    const parsed = packageWizardSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const column = String(issue.path[0] ?? "row");
        errors.push({ row, column, code: importIssueCode(issue.message) });
      }
      return;
    }

    if (typeof desiredPublished !== "boolean") {
      errors.push({ row, column: "is_published", code: "invalid_boolean" });
      return;
    }
    parsed.data.is_published = desiredPublished;
    const base = JSON.stringify({ ...parsed.data, prices: [] });
    const current = grouped.get(slug);
    if (!current) {
      grouped.set(slug, { firstRow: row, base, value: parsed.data });
      return;
    }
    if (current.base !== base) {
      errors.push({ row, column: "slug", code: "inconsistent_package" });
      return;
    }
    if (
      current.value.prices.some(
        (price) => price.country_code === parsed.data.prices[0]?.country_code,
      )
    ) {
      errors.push({ row, column: "country_code", code: "duplicate_country" });
      return;
    }
    const price = parsed.data.prices[0];
    if (price) current.value.prices.push(price);
  });

  const payload: PackageWizardInput[] = [];
  for (const item of grouped.values()) {
    const final = packageWizardSchema.safeParse(item.value);
    if (!final.success) {
      for (const issue of final.error.issues) {
        errors.push({
          row: item.firstRow,
          column: String(issue.path[0] ?? "row"),
          code: importIssueCode(issue.message),
        });
      }
    } else {
      payload.push(final.data);
    }
  }
  return { errors, payload };
}

function splitFeatures(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function numberValue(value: string) {
  return value === "" ? Number.NaN : Number(value);
}

function booleanValue(value: string) {
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return value;
}

function importIssueCode(message: string) {
  return ["duplicate_country", "below_minimum", "above_maximum", "fallback_required"].includes(
    message,
  )
    ? message
    : "invalid_value";
}
