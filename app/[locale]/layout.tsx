import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { amiriArabic, amiriLatin, cairoArabic, cairoLatin } from "@/app/fonts";
import { routing } from "@/i18n/routing";

import "../globals.css";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export const viewport: Viewport = {
  themeColor: "#faf6ec",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Omit<LocaleLayoutProps, "children">): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: {
      default: t("title"),
      template: `%s | ${t("title")}`,
    },
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "accessibility" });

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${cairoArabic.variable} ${cairoLatin.variable} ${amiriArabic.variable} ${amiriLatin.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:font-bold focus:text-primary-foreground focus:shadow-card focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
          >
            {t("skipToContent")}
          </a>
          {children}
        </NextIntlClientProvider>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
