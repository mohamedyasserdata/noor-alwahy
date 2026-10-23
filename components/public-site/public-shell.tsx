import { LogIn, Menu } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type PublicShellProps = {
  children: React.ReactNode;
  locale: AppLocale;
};

const navigation = [
  { href: "/", key: "home" },
  { href: "/tracks", key: "tracks" },
  { href: "/packages", key: "packages" },
  { href: "/faq", key: "faq" },
  { href: "/contact", key: "contact" },
] as const;

function LanguageFallback() {
  return <span className="block size-11 rounded-full border bg-card" aria-hidden="true" />;
}

export async function PublicShell({ children, locale }: PublicShellProps) {
  const t = await getTranslations({ locale, namespace: "publicSite.shell" });

  return (
    <div className="min-h-svh overflow-x-clip">
      <header className="safe-header sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <BrandMark label={t("brand")} />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label={t("navigationLabel")}>
            {navigation.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex min-h-11 items-center rounded-lg px-4 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent/55 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t(`navigation.${item.key}`)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle
              compact
              enableDarkLabel={t("theme.enableDark")}
              enableLightLabel={t("theme.enableLight")}
              className="rounded-full"
            />
            <Suspense fallback={<LanguageFallback />}>
              <LocaleSwitcher compact />
            </Suspense>
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link href="/auth/login">
                <LogIn aria-hidden="true" />
                {t("login")}
              </Link>
            </Button>
            <details className="group relative lg:hidden">
              <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-lg border bg-card text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <Menu className="size-5" aria-hidden="true" />
                <span className="sr-only">{t("openMenu")}</span>
              </summary>
              <nav
                className="absolute end-0 top-14 grid w-64 gap-1 rounded-2xl border bg-card p-2 shadow-soft"
                aria-label={t("navigationLabel")}
              >
                {navigation.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="flex min-h-11 items-center rounded-lg px-4 font-bold text-primary hover:bg-accent/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {t(`navigation.${item.key}`)}
                  </Link>
                ))}
                <Link
                  href="/auth/login"
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <LogIn className="size-4" aria-hidden="true" />
                  {t("login")}
                </Link>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="main-content">{children}</main>

      <footer className="border-t bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:grid-cols-[1fr_auto] sm:items-end lg:px-8">
          <div className="max-w-xl">
            <BrandMark
              label={t("brand")}
              labelClassName="text-primary-foreground"
              className="[&_span:first-child]:bg-primary-foreground"
            />
            <p className="mt-4 text-sm leading-7 text-primary-foreground/75">
              {t("footerDescription")}
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold"
            aria-label={t("footerLabel")}
          >
            {navigation.slice(1).map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="min-h-11 content-center rounded-md text-primary-foreground/80 underline-offset-4 hover:text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
              >
                {t(`navigation.${item.key}`)}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
