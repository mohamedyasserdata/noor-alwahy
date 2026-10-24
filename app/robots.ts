import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/ar/", "/en/"],
      disallow: [
        "/ar/admin/",
        "/en/admin/",
        "/ar/teacher/",
        "/en/teacher/",
        "/ar/student/",
        "/en/student/",
        "/ar/parent/",
        "/en/parent/",
        "/ar/offer/",
        "/en/offer/",
        "/api/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
