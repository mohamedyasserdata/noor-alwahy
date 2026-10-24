"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getPathname, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type LocaleSwitcherProps = {
  compact?: boolean;
};

export function LocaleSwitcher({ compact = false }: LocaleSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("localeSwitcher");
  const query = Object.fromEntries(
    [...new Set(searchParams.keys())].map((key) => {
      const values = searchParams.getAll(key);

      return [key, values.length === 1 ? values[0] : values];
    }),
  );
  const href = searchParams.size > 0 ? { pathname, query } : pathname;
  const alternateLocale =
    routing.locales.find((option) => option !== locale) ?? routing.defaultLocale;
  const localizedHref = (option: (typeof routing.locales)[number]) =>
    getPathname({ href, locale: option });

  if (compact) {
    return (
      <nav className="flex" aria-label={t("label")}>
        <Button asChild variant="outline" size="icon" className="rounded-full">
          <a
            href={localizedHref(alternateLocale)}
            aria-label={t("switchTo", { language: t(alternateLocale) })}
            title={t("switchTo", { language: t(alternateLocale) })}
            lang={alternateLocale}
            dir={alternateLocale === "ar" ? "rtl" : "ltr"}
          >
            <Languages aria-hidden="true" />
          </a>
        </Button>
      </nav>
    );
  }

  return (
    <nav
      className="inline-flex min-h-11 items-center gap-1 rounded-full border bg-card p-1 shadow-card"
      aria-label={t("label")}
    >
      <Languages className="ms-2 size-4 text-secondary" aria-hidden="true" />
      {routing.locales.map((option) => (
        <Button key={option} asChild variant={option === locale ? "default" : "ghost"}>
          <a
            href={localizedHref(option)}
            aria-current={option === locale ? "page" : undefined}
            aria-label={t("switchTo", { language: t(option) })}
            lang={option}
            dir={option === "ar" ? "rtl" : "ltr"}
          >
            {t(option)}
          </a>
        </Button>
      ))}
    </nav>
  );
}
