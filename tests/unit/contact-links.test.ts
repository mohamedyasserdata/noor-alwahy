import { describe, expect, it } from "vitest";

import {
  createContactLinkSchema,
  deleteContactLinkSchema,
  updateContactLinkSchema,
} from "../../lib/validators/contact-links";

const validLink = {
  isVisible: "true",
  labelAr: "واتساب الأكاديمية",
  labelEn: "Academy WhatsApp",
  sortOrder: "2",
  type: "whatsapp",
  url: "https://wa.me/201000000000",
};

describe("contact link boundaries", () => {
  it("normalizes a valid bilingual link", () => {
    const result = createContactLinkSchema.parse(validLink);

    expect(result.isVisible).toBe(true);
    expect(result.sortOrder).toBe(2);
    expect(result.labelEn).toBe("Academy WhatsApp");
  });

  it("accepts approved phone and email protocols", () => {
    expect(
      createContactLinkSchema.safeParse({
        ...validLink,
        type: "phone",
        url: "tel:+201000000000",
      }).success,
    ).toBe(true);
    expect(
      createContactLinkSchema.safeParse({
        ...validLink,
        type: "email",
        url: "mailto:hello@example.test",
      }).success,
    ).toBe(true);
  });

  it("accepts every requested social channel with a secure URL", () => {
    for (const type of ["whatsapp", "facebook", "instagram", "telegram", "youtube", "tiktok"]) {
      expect(
        createContactLinkSchema.safeParse({
          ...validLink,
          type,
          url: `https://example.test/${type}`,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects a destination protocol that does not match the selected channel", () => {
    expect(
      createContactLinkSchema.safeParse({
        ...validLink,
        type: "phone",
        url: "https://example.test/phone",
      }).success,
    ).toBe(false);
    expect(
      createContactLinkSchema.safeParse({
        ...validLink,
        type: "facebook",
        url: "mailto:hello@example.test",
      }).success,
    ).toBe(false);
  });

  it("rejects script, insecure, and control-character URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://example.test",
      "https://example.test\nattack",
    ]) {
      expect(createContactLinkSchema.safeParse({ ...validLink, url }).success).toBe(false);
    }
  });

  it("requires bounded labels, ordering, and known types", () => {
    expect(createContactLinkSchema.safeParse({ ...validLink, labelAr: " " }).success).toBe(false);
    expect(createContactLinkSchema.safeParse({ ...validLink, sortOrder: "-1" }).success).toBe(
      false,
    );
    expect(createContactLinkSchema.safeParse({ ...validLink, type: "custom" }).success).toBe(false);
  });

  it("validates identifiers for update and deletion", () => {
    const id = "c1000000-0000-4000-8000-000000000003";
    expect(updateContactLinkSchema.safeParse({ id, ...validLink }).success).toBe(true);
    expect(deleteContactLinkSchema.safeParse({ id }).success).toBe(true);
    expect(deleteContactLinkSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
  });
});
