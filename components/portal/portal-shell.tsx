import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AccountMenu } from "@/components/account/account-menu";
import { BrandMark } from "@/components/brand/brand-mark";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationCenter } from "@/components/notifications/notification-center";
import type { PortalId } from "@/components/portal/portal-config";
import { PortalNavigation } from "@/components/portal/portal-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AppLocale } from "@/i18n/routing";
import type { UserRole } from "@/lib/auth/roles";
import { getPublicAppSettings } from "@/lib/settings/public-settings";
import { getNotificationCenter } from "@/lib/notifications/queries";
import { cn } from "@/lib/utils";

type PortalShellProps = {
  account: {
    email: string;
    fullName: string;
    role: UserRole;
    timezone: string;
  };
  children: React.ReactNode;
  locale: AppLocale;
  portal: PortalId;
};

export async function PortalShell({ account, children, locale, portal }: PortalShellProps) {
  const [t, settings, notificationCenter] = await Promise.all([
    getTranslations({ locale, namespace: "portals" }),
    getPublicAppSettings(),
    getNotificationCenter(),
  ]);
  const academyName =
    locale === "ar" ? settings.academyProfile.nameAr : settings.academyProfile.nameEn;
  const isHorizontalPortal = portal === "student" || portal === "parent";
  const isAdminPortal = portal === "admin";
  const accountLabels = {
    accountSettings: t("account.accountSettings"),
    closeHint: t("account.closeHint"),
    email: t("account.email"),
    role: t("account.role"),
    roles: {
      admin: t("account.roles.admin"),
      teacher: t("account.roles.teacher"),
      student: t("account.roles.student"),
      parent: t("account.roles.parent"),
    },
    signOut: t("account.signOut"),
    timezone: t("account.timezone"),
  };

  return (
    <div
      className={cn(
        "min-h-svh",
        isHorizontalPortal && "bg-[#fbf8ef] dark:bg-background",
        isAdminPortal && "admin-workspace",
      )}
      data-testid={`portal-shell-${portal}`}
    >
      {!isHorizontalPortal && !isAdminPortal && notificationCenter ? (
        <NotificationCenter initialData={notificationCenter} portal={portal} />
      ) : null}
      {isHorizontalPortal ? (
        <header
          className="sticky top-0 z-40 border-b border-secondary/20 bg-[#fffdf8]/96 shadow-[0_0.35rem_1.5rem_-1.1rem_rgb(15_37_71_/_0.25)] backdrop-blur-xl dark:bg-card/96"
          data-testid={`${portal}-portal-header`}
        >
          <div className="safe-header mx-auto grid w-full max-w-[100rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 sm:px-6 lg:px-8">
            <BrandMark
              label={academyName}
              logoPath={settings.academyProfile.logoPath}
              className="min-h-20 shrink-0 [&>span:first-child]:size-14"
              labelClassName="hidden max-w-48 text-base leading-6 min-[560px]:block"
            />

            <div className="hidden min-w-0 px-2 min-[980px]:block">
              <PortalNavigation portal={portal} variant="top" />
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2">
              {notificationCenter ? (
                <NotificationCenter initialData={notificationCenter} portal={portal} inline />
              ) : null}
              <AccountMenu account={account} labels={accountLabels} locale={locale} compact />
              <ThemeToggle
                compact
                enableDarkLabel={t("theme.enableDark")}
                enableLightLabel={t("theme.enableLight")}
              />
              <Suspense fallback={<ControlFallback compact />}>
                <LocaleSwitcher compact />
              </Suspense>
            </div>

            <div className="col-span-full min-w-0 border-t border-secondary/15 py-1.5 min-[980px]:hidden">
              <PortalNavigation portal={portal} variant="top" />
            </div>
          </div>
        </header>
      ) : (
        <aside
          className={cn(
            "inset-block-0 fixed start-0 z-30 hidden h-svh flex-col overflow-hidden border-e bg-card/95 shadow-card backdrop-blur min-[769px]:flex",
            isAdminPortal
              ? "w-[17rem] border-secondary/20 bg-[#fffdf8]/98 dark:bg-card/98"
              : "w-72",
          )}
          data-testid="portal-sidebar"
        >
          <div className={cn("shrink-0 border-b", isAdminPortal ? "px-4 py-3" : "px-5 py-5")}>
            <BrandMark
              label={academyName}
              logoPath={settings.academyProfile.logoPath}
              className={cn(isAdminPortal && "min-h-14 [&>span:first-child]:size-11")}
              labelClassName={cn(isAdminPortal && "text-base leading-6")}
            />
          </div>

          {!isAdminPortal ? (
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
          ) : null}

          <PortalNavigation portal={portal} variant="sidebar" />

          {!isAdminPortal ? (
            <div className="mt-auto grid shrink-0 gap-3 border-t p-4">
              <AccountMenu account={account} labels={accountLabels} locale={locale} />
              <ThemeToggle
                enableDarkLabel={t("theme.enableDark")}
                enableLightLabel={t("theme.enableLight")}
              />
              <Suspense fallback={<ControlFallback />}>
                <LocaleSwitcher />
              </Suspense>
            </div>
          ) : null}
        </aside>
      )}

      <div
        className={cn(
          "min-h-svh",
          !isHorizontalPortal && !isAdminPortal && "min-[769px]:ps-72",
          isAdminPortal && "min-[769px]:ps-[17rem]",
        )}
      >
        {isAdminPortal ? (
          <header
            className="safe-header sticky top-0 z-20 flex min-h-16 items-center justify-between gap-2 border-b border-secondary/20 bg-[#fffdf8]/94 shadow-[0_0.35rem_1.5rem_-1.2rem_rgb(16_31_59_/_0.25)] backdrop-blur-xl min-[769px]:min-h-18 min-[769px]:justify-end min-[769px]:px-6 dark:bg-card/94"
            data-testid="admin-portal-topbar"
          >
            <BrandMark
              label={academyName}
              logoPath={settings.academyProfile.logoPath}
              className="shrink-0 min-[769px]:hidden"
              labelClassName="sr-only min-[440px]:not-sr-only min-[440px]:text-base"
            />
            <div className="flex items-center gap-2">
              {notificationCenter ? (
                <NotificationCenter initialData={notificationCenter} portal={portal} inline />
              ) : null}
              <ThemeToggle
                compact
                enableDarkLabel={t("theme.enableDark")}
                enableLightLabel={t("theme.enableLight")}
              />
              <Suspense fallback={<ControlFallback compact />}>
                <LocaleSwitcher compact />
              </Suspense>
              <div className="min-[769px]:hidden">
                <AccountMenu account={account} labels={accountLabels} locale={locale} compact />
              </div>
              <div className="hidden min-[769px]:block">
                <AccountMenu
                  account={account}
                  labels={accountLabels}
                  locale={locale}
                  placement="topbar"
                />
              </div>
            </div>
          </header>
        ) : null}
        {!isHorizontalPortal && !isAdminPortal ? (
          <header className="safe-header sticky top-0 z-20 flex min-h-16 items-center justify-between gap-2 border-b bg-background/92 pe-14 backdrop-blur min-[769px]:hidden">
            <BrandMark
              label={academyName}
              logoPath={settings.academyProfile.logoPath}
              className="shrink-0"
              labelClassName="sr-only min-[440px]:not-sr-only min-[440px]:text-base"
            />
            <div className="flex items-center gap-2">
              <AccountMenu account={account} labels={accountLabels} locale={locale} compact />
              <ThemeToggle
                compact
                enableDarkLabel={t("theme.enableDark")}
                enableLightLabel={t("theme.enableLight")}
              />
              <Suspense fallback={<ControlFallback compact />}>
                <LocaleSwitcher compact />
              </Suspense>
            </div>
          </header>
        ) : null}

        <main
          id="main-content"
          className={cn(
            "min-h-[calc(100svh-4rem)] w-full",
            isHorizontalPortal
              ? "min-h-svh overflow-hidden"
              : isAdminPortal
                ? "mx-auto max-w-[112rem] px-3 pt-5 pb-28 min-[769px]:min-h-[calc(100svh-4.5rem)] min-[769px]:px-6 min-[769px]:pt-7 min-[769px]:pb-10 sm:px-5 xl:px-8"
                : "mx-auto max-w-[96rem] px-4 pt-7 pb-28 min-[769px]:min-h-svh min-[769px]:px-10 min-[769px]:pt-12 min-[769px]:pb-12 sm:px-6 sm:pt-10 xl:px-14",
          )}
        >
          {children}
        </main>
      </div>

      {!isHorizontalPortal ? (
        <div
          className="safe-bottom fixed inset-x-0 bottom-0 z-30 h-[5.25rem] border-t bg-card/96 shadow-[0_-0.75rem_2rem_-1.5rem_rgb(15_37_71_/_0.28)] backdrop-blur min-[769px]:hidden"
          data-testid="portal-bottom-nav"
        >
          <PortalNavigation portal={portal} variant="bottom" />
        </div>
      ) : null}
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
