import type { Metadata } from "next";

import type { AppLocale } from "@/i18n/routing";

const siteUrlSchema = /^https?:\/\/[^\s/$.?#].[^\s]*$/;

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl && siteUrlSchema.test(configuredUrl)) {
    return configuredUrl.replace(/\/$/, "");
  }

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercelHost ? `https://${vercelHost}` : "http://localhost:3000";
}

export function localizedMetadata({
  locale,
  path,
  title,
  description,
}: {
  locale: AppLocale;
  path: string;
  title: string;
  description: string;
}): Metadata {
  const normalizedPath = path === "/" ? "" : path;
  const canonical = `/${locale}${normalizedPath}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ar: `/ar${normalizedPath}`,
        en: `/en${normalizedPath}`,
        "x-default": `/ar${normalizedPath}`,
      },
    },
    openGraph: {
      title,
      description,
      locale: locale === "ar" ? "ar_EG" : "en_US",
      type: "website",
      url: canonical,
    },
  };
}
