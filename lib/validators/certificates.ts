import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).default("");
const assetPath = z.union([
  z.string().regex(/^certificates\/(logos|seals|signatures)\/[a-zA-Z0-9._/-]{1,180}$/),
  z.literal(""),
]);

export const certificateTemplateSchema = z
  .object({
    kind: z.enum(["memorization", "excellence", "attendance", "ijazah", "juz", "other"]),
    nameAr: z.string().trim().min(2).max(120),
    nameEn: optionalText(120),
    titleAr: z.string().trim().min(2).max(180),
    titleEn: optionalText(180),
    bodyAr: z.string().trim().min(10).max(1200),
    bodyEn: optionalText(1200),
    logoPath: assetPath.default(""),
    sealPath: assetPath.default(""),
    signerName: optionalText(100),
    signerTitle: optionalText(100),
    signaturePath: assetPath.default(""),
    style: z.enum(["geometric", "arabesque", "minimal", "illuminated"]),
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .refine((value) => !value.signerName || value.signerTitle.length >= 2, { path: ["signerTitle"] });

export const certificateTemplateUpdateSchema = certificateTemplateSchema.and(
  z.object({ versionId: z.uuid() }),
);

export const certificateVersionSchema = z.object({ versionId: z.uuid() });
export const issueCertificateSchema = z.object({
  versionId: z.uuid(),
  studentId: z.uuid(),
  locale: z.enum(["ar", "en"]),
  achievement: z.string().trim().min(2).max(500),
});
export const batchCertificateSchema = z.object({
  versionId: z.uuid(),
  studentIds: z.array(z.uuid()).min(1).max(500),
  locale: z.enum(["ar", "en"]),
  achievement: z.string().trim().min(2).max(500),
});
export const processCertificateBatchSchema = z.object({ batchId: z.uuid() });
export const revokeCertificateSchema = z.object({
  certificateId: z.uuid(),
  reason: z.string().trim().min(5).max(500),
});
