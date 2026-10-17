import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const routeLocale = await rootParams.locale();

    if (!hasLocale(routing.locales, routeLocale)) {
      notFound();
    }

    locale = routeLocale;
  }

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
