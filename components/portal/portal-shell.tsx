import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationCenter } from "@/components/notifications/notification-center";
import type { PortalId } from "@/components/portal/portal-config";
import { PortalNavigation } from "@/components/portal/portal-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AppLocale } from "@/i18n/routing";
import { getPublicAppSettings } from "@/lib/settings/public-settings";
import { getNotificationCenter } from "@/lib/notifications/queries";

type PortalShellProps = {
  children: React.ReactNode;
  locale: AppLocale;
  portal: PortalId;
};

export async function PortalShell({ children, locale, portal }: PortalShellProps) {
  const [t, settings, notificationCenter] = await Promise.all([
    getTranslations({ locale, namespace: "portals" }),
    getPublicAppSettings(),
    getNotificationCenter(),
  ]);
  const academyName =
    locale === "ar" ? settings.academyProfile.nameAr : settings.academyProfile.nameEn;

  return (
    <div className="min-h-svh" data-testid={`portal-shell-${portal}`}>
      {notificationCenter ? (
        <NotificationCenter initialData={notificationCenter} portal={portal} />
      ) : null}
      <aside
        className="inset-block-0 fixed start-0 z-30 hidden h-svh w-72 flex-col overflow-hidden border-e bg-card/95 shadow-card backdrop-blur min-[769px]:flex"
        data-testid="portal-sidebar"
      >
        <div className="shrink-0 border-b px-5 py-5">
          <BrandMark label={academyName} logoPath={settings.academyProfile.logoPath} />
        </div>

        <div className="relative mx-5 my-6 shrink-0 overflow-hidden rounded-t-[7rem] rounded-b-2xl border border-secondary/35 bg-background px-5 pt-9 pb-5 text-center">
          <span
            className="absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-secondary to-transparent"
            aria-hidden="true"
          />
          <span
            className="mx-auto mb-3 block size-2 rounded-full bg-secondary shadow-[0_0_0_0.3rem_rgb(201_162_75_/_0.14)]"
            aria-hidden="true"
          />
          <p className="text-xs font-extrabold tracking-[0.12em] text-secondary uppercase">
            {t("workspaceLabel")}
          </p>
          <p className="mt-1 text-lg font-black text-primary">{t(`${portal}.roleName`)}</p>
        </div>

        <PortalNavigation portal={portal} variant="sidebar" />

        <div className="mt-auto grid shrink-0 gap-3 border-t p-4">
          <ThemeToggle
            enableDarkLabel={t("theme.enableDark")}
            enableLightLabel={t("theme.enableLight")}
          />
          <Suspense fallback={<ControlFallback />}>
            <LocaleSwitcher />
          </Suspense>
        </div>
      </aside>

      <div className="min-h-svh min-[769px]:ps-72">
        <header className="safe-header sticky top-0 z-20 flex min-h-16 items-center justify-between gap-2 border-b bg-background/92 pe-14 backdrop-blur min-[769px]:hidden">
          <BrandMark
            label={academyName}
            logoPath={settings.academyProfile.logoPath}
            className="shrink-0"
            labelClassName="sr-only min-[440px]:not-sr-only min-[440px]:text-base"
          />
          <div className="flex items-center gap-2">
            <ThemeToggle
              compact
              enableDarkLabel={t("theme.enableDark")}
              enableLightLabel={t("theme.enableLight")}
            />
            <Suspense fallback={<ControlFallback compact />}>
              <LocaleSwitcher />
            </Suspense>
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto min-h-[calc(100svh-4rem)] w-full max-w-[96rem] px-4 pt-7 pb-28 min-[769px]:min-h-svh min-[769px]:px-10 min-[769px]:pt-12 min-[769px]:pb-12 sm:px-6 sm:pt-10 xl:px-14"
        >
          {children}
        </main>
      </div>

      <div
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 h-[5.25rem] border-t bg-card/96 shadow-[0_-0.75rem_2rem_-1.5rem_rgb(15_37_71_/_0.28)] backdrop-blur min-[769px]:hidden"
        data-testid="portal-bottom-nav"
      >
        <PortalNavigation portal={portal} variant="bottom" />
      </div>
    </div>
  );
}

function ControlFallback({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        compact
          ? "block size-11 rounded-full border bg-card"
          : "block h-11 rounded-lg border bg-card"
      }
      aria-hidden="true"
    />
  );
}
