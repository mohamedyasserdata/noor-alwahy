import { z } from "zod";

export const contactLinkTypes = [
  "whatsapp",
  "phone",
  "email",
  "facebook",
  "instagram",
  "telegram",
  "youtube",
  "tiktok",
  "other",
] as const;

const safeContactUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => /^(https:\/\/|mailto:|tel:)/i.test(value), "unsupported_protocol")
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "unsafe_character");

const contactLinkFields = {
  isVisible: z.enum(["true", "false"]).transform((value) => value === "true"),
  labelAr: z.string().trim().min(1).max(100),
  labelEn: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || null),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  type: z.enum(contactLinkTypes),
  url: safeContactUrlSchema,
};

export const createContactLinkSchema = z.object(contactLinkFields);

export const updateContactLinkSchema = z.object({
  id: z.uuid(),
  ...contactLinkFields,
});

export const deleteContactLinkSchema = z.object({ id: z.uuid() });

export type ContactLinkType = (typeof contactLinkTypes)[number];
