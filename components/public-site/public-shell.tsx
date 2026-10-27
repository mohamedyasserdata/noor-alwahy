import { LogIn, Menu, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { ContactChannelIcon } from "@/components/contact/contact-channel-icon";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getPublicContactLinks } from "@/lib/contact-links/get-contact-links";

type PublicShellProps = {
  children: React.ReactNode;
  locale: AppLocale;
};

const navigation = [
  { href: "/", key: "home" },
  { href: "/#tracks", key: "tracks" },
  { href: "/#teachers", key: "teachers" },
  { href: "/join-teachers", key: "joinTeachers" },
  { href: "/#packages", key: "packages" },
  { href: "/#faq", key: "faq" },
  { href: "/contact", key: "contact" },
] as const;

const legalNavigation = [
  { href: "/privacy", key: "privacy" },
  { href: "/terms", key: "terms" },
] as const;

function LanguageFallback({ mobile = false }: { mobile?: boolean }) {
  return (
    <span
      className={
        mobile
          ? "block h-11 w-full rounded-full border bg-card"
          : "block size-11 rounded-full border bg-card"
      }
      aria-hidden="true"
    />
  );
}

export async function PublicShell({ children, locale }: PublicShellProps) {
  const [t, rawContactLinks] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite.shell" }),
    getPublicContactLinks(),
  ]);
  const contactLinks = Array.from(
    new Map(rawContactLinks.map((link) => [link.url, link])).values(),
  );

  return (
    <div className="min-h-svh overflow-x-clip">
      <header className="safe-header sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div className="mx-auto flex min-h-20 max-w-[90rem] items-center justify-between gap-3 rounded-[1.75rem] border border-secondary/20 bg-[#fffaf0]/92 px-3 shadow-[0_14px_45px_rgba(16,31,59,.10)] backdrop-blur-xl sm:px-5 dark:bg-[#0c1b33]/92">
          <Link
            href="/"
            className="shrink-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <BrandMark label={t("brand")} />
          </Link>

          <nav className="hidden items-center gap-0.5 xl:flex" aria-label={t("navigationLabel")}>
            {navigation.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex min-h-11 items-center rounded-xl px-3.5 text-sm font-bold text-[#263957] transition-colors hover:bg-[#f4e6c9] hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-[#f5f0e6]/75 dark:hover:bg-white/10"
              >
                {t(`navigation.${item.key}`)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <ThemeToggle
                compact
                enableDarkLabel={t("theme.enableDark")}
                enableLightLabel={t("theme.enableLight")}
                className="rounded-full"
              />
              <Suspense fallback={<LanguageFallback />}>
                <LocaleSwitcher compact />
              </Suspense>
            </div>
            <Button
              asChild
              variant="outline"
              className="hidden rounded-xl border-secondary/35 bg-white/50 lg:inline-flex dark:bg-white/5"
            >
              <Link href="/auth/login">
                <LogIn aria-hidden="true" />
                {t("login")}
              </Link>
            </Button>
            <Button asChild variant="gold" className="hidden rounded-xl px-5 sm:inline-flex">
              <Link href="/apply">
                <Sparkles aria-hidden="true" />
                {t("navigation.apply")}
              </Link>
            </Button>
            <details className="group relative xl:hidden">
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
                <div className="grid gap-2 border-t border-secondary/20 pt-2 sm:hidden">
                  <ThemeToggle
                    enableDarkLabel={t("theme.enableDark")}
                    enableLightLabel={t("theme.enableLight")}
                    className="rounded-xl transition-none"
                  />
                  <Suspense fallback={<LanguageFallback mobile />}>
                    <LocaleSwitcher />
                  </Suspense>
                </div>
                <Link
                  href="/apply"
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-secondary px-4 font-bold text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {t("navigation.apply")}
                </Link>
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

      <footer className="border-t border-secondary/20 bg-primary text-primary-foreground">
        <div className="islamic-pattern mx-auto grid max-w-[90rem] gap-8 px-6 py-12 sm:grid-cols-[1fr_auto] sm:items-end lg:px-10">
          <div className="max-w-xl">
            <BrandMark
              label={t("brand")}
              labelClassName="text-primary-foreground"
              className="[&_span:first-child]:bg-primary-foreground"
            />
            <p className="mt-4 text-sm leading-7 text-primary-foreground/75">
              {t("footerDescription")}
            </p>
            {contactLinks.length > 0 ? (
              <nav
                className="mt-5 flex flex-wrap gap-2"
                aria-label={t("footerContactLabel")}
                data-testid="footer-contact-links"
              >
                {contactLinks.map((link) => {
                  const label = locale === "en" && link.labelEn ? link.labelEn : link.labelAr;
                  const external = link.url.toLowerCase().startsWith("https://");

                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noopener noreferrer" : undefined}
                      aria-label={label}
                      title={label}
                      className="grid size-11 place-items-center rounded-full border border-secondary/35 bg-white/8 text-secondary transition-colors hover:border-secondary hover:bg-secondary hover:text-primary focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary focus-visible:outline-none [&_svg]:size-5"
                    >
                      <ContactChannelIcon type={link.type} />
                    </a>
                  );
                })}
              </nav>
            ) : null}
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
            {legalNavigation.map((item) => (
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
