"use client";

import {
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  FileChartColumn,
  House,
  Mail,
  ScrollText,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSelectedLayoutSegment } from "next/navigation";

import { portalConfig, type PortalId } from "@/components/portal/portal-config";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const sectionIcons = {
  dashboard: ChartNoAxesCombined,
  applications: ClipboardList,
  students: Users,
  audit: ScrollText,
  settings: Settings,
  today: Clock3,
  reports: FileChartColumn,
  availability: CalendarDays,
  home: House,
  progress: Sparkles,
  schedule: CalendarDays,
  certificates: BadgeCheck,
  children: Users,
  billing: Banknote,
  contact: Mail,
} as const;

type PortalNavigationProps = {
  portal: PortalId;
  variant: "sidebar" | "bottom";
};

export function PortalNavigation({ portal, variant }: PortalNavigationProps) {
  const activeSection = useSelectedLayoutSegment();
  const t = useTranslations(`portals.${portal}`);
  const sections = portalConfig[portal].sections;
  const isSidebar = variant === "sidebar";

  return (
    <nav
      aria-label={t("navigationLabel")}
      data-testid={`portal-navigation-${variant}`}
      className={cn(
        isSidebar ? "grid gap-1.5 px-4" : "grid h-full items-stretch",
        !isSidebar && sections.length === 3 && "grid-cols-3",
        !isSidebar && sections.length === 4 && "grid-cols-4",
        !isSidebar && sections.length === 5 && "grid-cols-5",
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
              !isSidebar &&
                "min-w-0 flex-col justify-center gap-1 px-1 py-2 text-center text-xs leading-tight",
              !isSidebar && isActive && "text-primary",
              !isSidebar && !isActive && "text-muted-foreground hover:text-foreground",
            )}
          >
            {!isSidebar && isActive && (
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
