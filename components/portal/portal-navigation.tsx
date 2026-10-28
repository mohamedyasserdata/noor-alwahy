"use client";

import {
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  CalendarDays,
  CalendarCheck,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  Command,
  Clock3,
  CreditCard,
  FileChartColumn,
  GraduationCap,
  House,
  Link2,
  Mail,
  Menu,
  Megaphone,
  PackageOpen,
  Scale,
  ScrollText,
  Settings,
  Files,
  Sparkles,
  UserRoundCheck,
  UserRoundCog,
  Users,
  WalletCards,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSelectedLayoutSegment } from "next/navigation";

import { portalConfig, type PortalId } from "@/components/portal/portal-config";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const sectionIcons = {
  dashboard: ChartNoAxesCombined,
  "control-center": Command,
  packages: PackageOpen,
  applications: ClipboardList,
  "teacher-applications": UserRoundCheck,
  subscriptions: CreditCard,
  finance: Banknote,
  assignments: UserRoundCheck,
  students: Users,
  teachers: GraduationCap,
  users: UserRoundCog,
  audit: ScrollText,
  settings: Settings,
  today: Clock3,
  reports: FileChartColumn,
  announcements: Megaphone,
  templates: Files,
  availability: CalendarDays,
  home: House,
  progress: Sparkles,
  schedule: CalendarDays,
  attendance: CalendarCheck,
  evaluation: Scale,
  evaluations: BookOpenCheck,
  exams: ClipboardList,
  zoom: Link2,
  earnings: WalletCards,
  certificates: BadgeCheck,
  children: Users,
  billing: Banknote,
  contact: Mail,
} as const;

type PortalNavigationProps = {
  portal: PortalId;
  variant: "sidebar" | "bottom" | "top";
};

export function PortalNavigation({ portal, variant }: PortalNavigationProps) {
  const activeSection = useSelectedLayoutSegment();
  const t = useTranslations(`portals.${portal}`);
  const sections = portalConfig[portal].sections;
  const isSidebar = variant === "sidebar";
  const isTop = variant === "top";
  const adminGroups =
    portal === "admin" && isSidebar
      ? [
          { id: "students", icon: Users, sections: ["applications", "students"] },
          {
            id: "teachers",
            icon: GraduationCap,
            sections: ["teacher-applications", "teachers", "assignments"],
          },
          {
            id: "academics",
            icon: BookOpenCheck,
            sections: ["schedule", "attendance", "evaluation", "exams", "reports", "certificates"],
          },
          { id: "finance", icon: Banknote, sections: ["packages", "subscriptions", "finance"] },
          { id: "content", icon: Files, sections: ["announcements", "templates"] },
          {
            id: "system",
            icon: Settings,
            sections: ["control-center", "users", "audit", "settings"],
          },
        ]
      : null;

  const renderSection = (section: (typeof sections)[number]) => {
    const Icon = sectionIcons[section] ?? BookOpenCheck;
    const isActive = activeSection === section;

    return (
      <Link
        key={section}
        href={`/${portal}/${section}`}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group relative flex min-h-11 touch-manipulation items-center font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
          isSidebar && "gap-3 rounded-xl px-3 py-2.5 text-sm",
          isSidebar && isActive && "bg-primary text-primary-foreground shadow-card",
          isSidebar &&
            !isActive &&
            "text-muted-foreground hover:bg-accent/55 hover:text-foreground",
          isTop && "shrink-0 gap-2 rounded-xl px-3.5 py-2.5 text-sm",
          isTop &&
            isActive &&
            "bg-[#f5e8ca] text-[#7d500d] shadow-sm dark:bg-accent dark:text-[#fff3cf]",
          isTop && !isActive && "text-primary hover:bg-accent/45",
          !isSidebar &&
            !isTop &&
            "min-w-18 flex-1 flex-col justify-center gap-1 px-1 py-2 text-center text-xs leading-tight",
          !isSidebar && !isTop && isActive && "text-primary",
          !isSidebar && !isTop && !isActive && "text-muted-foreground hover:text-foreground",
        )}
      >
        {!isSidebar && !isTop && isActive ? (
          <span
            className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-secondary"
            aria-hidden="true"
          />
        ) : null}
        <Icon
          className={cn(
            "size-5 shrink-0",
            isSidebar && isActive ? "text-secondary" : "text-current",
          )}
          strokeWidth={isActive ? 2.25 : 1.8}
          aria-hidden="true"
        />
        <span className={cn(!isSidebar && "line-clamp-2")}>{t(`sections.${section}.label`)}</span>
      </Link>
    );
  };

  if (portal === "admin" && variant === "bottom") {
    const primarySections = ["dashboard", "applications", "schedule", "subscriptions"] as const;
    const moreSections = sections.filter(
      (section) => !primarySections.includes(section as (typeof primarySections)[number]),
    );

    return (
      <nav
        aria-label={t("navigationLabel")}
        data-testid="portal-navigation-bottom"
        className="grid h-full grid-cols-5 items-stretch"
      >
        {primarySections
          .slice(0, 2)
          .map((section) => renderSection(section as (typeof sections)[number]))}
        <details className="group/mobile-nav relative min-w-0">
          <summary
            className="relative flex h-full min-h-11 cursor-pointer touch-manipulation list-none flex-col items-center justify-center gap-1 px-1 py-2 text-center text-xs leading-tight font-bold text-muted-foreground marker:hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden"
            data-testid="admin-mobile-more"
          >
            <Menu className="size-5" aria-hidden="true" />
            <span>{t("groups.more")}</span>
          </summary>
          <section className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 max-h-[68svh] overflow-y-auto rounded-2xl border border-secondary/25 bg-card p-4 shadow-[0_1.25rem_3.5rem_-1rem_rgb(16_31_59_/_0.42)]">
            <div className="flex items-center justify-between gap-3 border-b border-secondary/15 pb-3">
              <h2 className="font-black text-primary">{t("groups.allSections")}</h2>
              <span className="text-xs text-muted-foreground">{moreSections.length}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {moreSections.map((section) => {
                const Icon = sectionIcons[section] ?? BookOpenCheck;
                const isActive = activeSection === section;
                return (
                  <Link
                    key={section}
                    href={`/admin/${section}`}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 text-start text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isActive
                        ? "border-secondary bg-secondary/15 text-primary"
                        : "border-secondary/15 bg-background/55 text-muted-foreground hover:bg-accent/55 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">{t(`sections.${section}.label`)}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </details>
        {primarySections
          .slice(2)
          .map((section) => renderSection(section as (typeof sections)[number]))}
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("navigationLabel")}
      data-testid={`portal-navigation-${variant}`}
      className={cn(
        isSidebar
          ? "grid min-h-0 flex-1 [scrollbar-gutter:stable] content-start gap-1.5 overflow-y-auto overscroll-contain px-4 pb-4"
          : isTop
            ? "flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
            : "grid h-full items-stretch",
        !isSidebar && !isTop && sections.length <= 5 && "grid-cols-5",
        !isSidebar && !isTop && sections.length > 5 && "flex overflow-x-auto",
      )}
    >
      {adminGroups
        ? [
            renderSection("dashboard" as (typeof sections)[number]),
            ...adminGroups.map((group) => {
              const GroupIcon = group.icon;
              const isGroupActive = group.sections.includes(activeSection ?? "");
              return (
                <details
                  key={group.id}
                  className="admin-nav-group group/nav rounded-xl"
                  open={isGroupActive || undefined}
                >
                  <summary
                    className={cn(
                      "flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black text-muted-foreground transition-colors marker:hidden hover:bg-accent/55 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden",
                      isGroupActive && "bg-secondary/10 text-primary",
                    )}
                  >
                    <GroupIcon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">{t(`groups.${group.id}`)}</span>
                    <ChevronDown
                      className="size-4 shrink-0 transition-transform group-open/nav:rotate-180 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="ms-5 mt-1 grid gap-1 border-s border-secondary/20 ps-2">
                    {group.sections.map((section) =>
                      renderSection(section as (typeof sections)[number]),
                    )}
                  </div>
                </details>
              );
            }),
          ]
        : sections.map(renderSection)}
    </nav>
  );
}
