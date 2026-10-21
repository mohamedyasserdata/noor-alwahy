import { z } from "zod";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
    z.string().min(2).max(maximum).optional(),
  );

export const announcementDraftSchema = z
  .object({
    announcementId: z.preprocess(
      (value) => (typeof value === "string" && value ? value : undefined),
      z.uuid().optional(),
    ),
    titleAr: z.string().trim().min(2).max(160),
    titleEn: optionalText(160),
    bodyAr: z.string().trim().min(2).max(4000),
    bodyEn: optionalText(4000),
    all: z.boolean(),
    roles: z.array(z.enum(["admin", "teacher", "student", "parent"])).max(4),
    countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(50),
    levelIds: z.array(z.uuid()).max(100),
    trackIds: z.array(z.uuid()).max(100),
    endsOn: z.preprocess(
      (value) => (typeof value === "string" && value ? value : undefined),
      z.iso.date().optional(),
    ),
  })
  .superRefine((value, context) => {
    if (
      !value.all &&
      value.roles.length === 0 &&
      value.countries.length === 0 &&
      value.levelIds.length === 0 &&
      value.trackIds.length === 0
    ) {
      context.addIssue({ code: "custom", path: ["all"], message: "audience_required" });
    }
  });

export const announcementTransitionSchema = z.object({ announcementId: z.uuid() });

export function announcementAudience(
  input: z.infer<typeof announcementDraftSchema>,
): Record<string, boolean | string[]> {
  if (input.all) return { all: true };
  return {
    all: false,
    ...(input.roles.length ? { roles: input.roles } : {}),
    ...(input.countries.length ? { countries: input.countries } : {}),
    ...(input.levelIds.length ? { level_ids: input.levelIds } : {}),
    ...(input.trackIds.length ? { track_ids: input.trackIds } : {}),
  };
}
