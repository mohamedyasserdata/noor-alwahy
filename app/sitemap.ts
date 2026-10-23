import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/seo/metadata";

const paths = ["", "/tracks", "/packages", "/faq", "/contact", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return paths.flatMap((path) =>
    (["ar", "en"] as const).map((locale) => ({
      url: `${siteUrl}/${locale}${path}`,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : 0.8,
      alternates: {
        languages: {
          ar: `${siteUrl}/ar${path}`,
          en: `${siteUrl}/en${path}`,
        },
      },
    })),
  );
}
