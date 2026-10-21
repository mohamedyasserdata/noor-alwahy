import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { PublicShell } from "@/components/public-site/public-shell";
import { routing } from "@/i18n/routing";

export default async function PublicLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return <PublicShell locale={locale}>{children}</PublicShell>;
}
