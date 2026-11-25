import { z } from "zod";

const optionalPage = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.coerce.number().int().min(1).max(604).nullable(),
);

export const quranBaselineSchema = z
  .object({
    studentId: z.uuid(),
    priorFromPage: optionalPage,
    priorToPage: optionalPage,
    academyStartPage: optionalPage,
    studyDirection: z.enum(["ascending", "descending"]),
    assessedOn: z.string().date(),
    assessmentNotes: z.string().trim().max(1200).optional().default(""),
  })
  .superRefine((value, context) => {
    const onePriorBoundary = (value.priorFromPage === null) !== (value.priorToPage === null);
    if (onePriorBoundary) {
      context.addIssue({
        code: "custom",
        path: ["priorFromPage"],
        message: "incomplete_prior_range",
      });
    }
  });
