"use client";

import {
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Command,
  Clock3,
  CreditCard,
  FileChartColumn,
  GraduationCap,
  House,
  Link2,
  Mail,
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
        !isSidebar && !isTop && sections.length === 4 && "grid-cols-4",
        !isSidebar && !isTop && sections.length > 4 && "flex overflow-x-auto",
      )}
    >
      {sections.map((section) => {
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
              isTop &&
                "min-w-max gap-2 rounded-xl border border-transparent px-3 py-2.5 text-sm text-primary sm:px-4",
              isTop && isActive && "border-secondary/25 bg-secondary/18 text-primary shadow-card",
              isTop && !isActive && "hover:border-secondary/20 hover:bg-card hover:text-primary",
              !isSidebar &&
                !isTop &&
                "min-w-18 flex-1 flex-col justify-center gap-1 px-1 py-2 text-center text-xs leading-tight",
              !isSidebar && !isTop && isActive && "text-primary",
              !isSidebar && !isTop && !isActive && "text-muted-foreground hover:text-foreground",
            )}
          >
            {!isSidebar && !isTop && isActive && (
              <span
                className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-secondary"
                aria-hidden="true"
              />
            )}
            <Icon
              className={cn(
                "size-5 shrink-0",
                isSidebar && isActive ? "text-secondary" : "text-current",
              )}
              strokeWidth={isActive ? 2.25 : 1.8}
              aria-hidden="true"
            />
            <span className={cn(!isSidebar && "line-clamp-2")}>
              {t(`sections.${section}.label`)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
