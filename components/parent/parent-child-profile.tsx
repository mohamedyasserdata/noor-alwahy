import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  House,
  UserRound,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  AttendancePanel,
  ChildOverviewPanel,
  ChildProgressPanel,
  ChildReportsPanel,
  ChildSchedulePanel,
} from "@/components/parent/parent-child-panels";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getStudentMemorizationPlan } from "@/lib/memorization-plans/queries";
import { getGuardianChildDetails } from "@/lib/parent/child-details";
import { getGuardianPortalContext } from "@/lib/parent/children";
import { getStudentProgressDashboard } from "@/lib/progress/dashboard";
import { cn } from "@/lib/utils";

type Search = Promise<Record<string, string | string[] | undefined>>;
const tabIds = ["overview", "progress", "attendance", "reports", "schedule"] as const;
type TabId = (typeof tabIds)[number];

const tabIcons = {
  overview: House,
  progress: BarChart3,
  attendance: CalendarDays,
  reports: FileText,
  schedule: CalendarDays,
} as const;

export async function ParentChildProfile({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Search;
}) {
  const [t, query, context] = await Promise.all([
    getTranslations({ locale, namespace: "parentPortal" }),
    searchParams,
    getGuardianPortalContext(),
  ]);
  const requested = typeof query.student === "string" ? query.student : "";
  const selected = context.children.find((child) => child.id === requested) ?? context.children[0];
  if (!selected) {
    return (
      <div className="mx-auto w-full max-w-[100rem] px-4 py-10 sm:px-6 lg:px-10">
        <Alert variant="warning">{t("children.empty")}</Alert>
      </div>
    );
  }

  const requestedTab = typeof query.view === "string" ? query.view : "overview";
  const activeTab: TabId = tabIds.includes(requestedTab as TabId)
    ? (requestedTab as TabId)
    : "overview";
  const [details, dashboard, plan] = await Promise.all([
    getGuardianChildDetails(selected.id),
    getStudentProgressDashboard(selected.id),
    getStudentMemorizationPlan(selected.id),
  ]);
  const track = locale === "ar" ? selected.trackAr : selected.trackEn;
  const level = locale === "ar" ? selected.levelAr : selected.levelEn;
  const DirectionIcon = locale === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div className="parent-child-profile min-h-svh pb-12 sm:pb-16">
      <section
        className="relative min-h-[19rem] overflow-hidden bg-[url('/images/student/golden-quran-sunlit-mosque.png')] bg-cover bg-[position:38%_58%] sm:min-h-[20rem] lg:bg-[position:center_58%]"
        aria-labelledby="child-profile-title"
      >
        <div
          className="absolute inset-0 bg-linear-to-b from-[#fffaf0]/10 via-[#fffaf0]/62 to-[#fffaf0] lg:bg-linear-to-r lg:from-transparent lg:via-[#fffaf0]/42 lg:to-[#fffaf0]/96 dark:from-[#091a33]/30 dark:via-[#091a33]/78 dark:to-[#091a33] lg:dark:from-[#091a33]/18 lg:dark:via-[#091a33]/68 lg:dark:to-[#091a33]/96"
          aria-hidden="true"
        />
        <div
          className="relative mx-auto grid min-h-[19rem] w-full max-w-[100rem] items-end px-5 pt-12 pb-16 sm:min-h-[20rem] sm:px-8 lg:grid-cols-2 lg:items-center lg:px-12 lg:py-10"
          dir="ltr"
        >
          <span aria-hidden="true" />
          <header
            className="max-w-2xl rounded-3xl bg-[#fffaf0]/78 p-5 backdrop-blur-[2px] sm:p-7 lg:bg-transparent lg:p-0 lg:backdrop-blur-none dark:bg-[#091a33]/78 lg:dark:bg-transparent"
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <Link
              href="/parent/home"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-[#8a5b12] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring dark:text-secondary"
            >
              <DirectionIcon className="size-4 rotate-180 rtl:rotate-0" aria-hidden="true" />
              {t("child.backHome")}
            </Link>
            <div className="mt-3 flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-full border-4 border-white bg-[#edf4ff] text-[#245fa8] shadow-card dark:border-card dark:bg-accent">
                <UserRound className="size-8" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1
                  id="child-profile-title"
                  className="text-4xl leading-tight font-black text-balance text-[#101f3b] sm:text-5xl dark:text-primary"
                >
                  {selected.name}
                </h1>
                <p className="mt-2 text-base text-[#5d6f86] sm:text-lg dark:text-muted-foreground">
                  {[track, level].filter(Boolean).join(" · ") || t("children.noPlacement")}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant={selected.status === "active" ? "success" : "outline"}>
                {t(`statuses.${selected.status}`)}
              </Badge>
              {selected.teacherName ? (
                <Badge variant="outline">
                  {t("child.teacher", { name: selected.teacherName })}
                </Badge>
              ) : null}
            </div>
            {context.children.length > 1 ? (
              <nav
                className="mt-4 flex flex-wrap gap-2"
                aria-label={locale === "ar" ? "تغيير الابن" : "Change child"}
              >
                {context.children.map((child) => (
                  <Link
                    key={child.id}
                    href={{
                      pathname: "/parent/children",
                      query: { student: child.id, view: activeTab },
                    }}
                    aria-current={child.id === selected.id ? "true" : undefined}
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      child.id === selected.id
                        ? "border-secondary bg-secondary/15 text-primary"
                        : "bg-card/75 text-muted-foreground hover:text-primary",
                    )}
                  >
                    {child.name}
                  </Link>
                ))}
              </nav>
            ) : null}
          </header>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-10 w-full max-w-[100rem] px-4 sm:px-6 lg:px-10">
        <nav
          className="flex min-w-0 [scrollbar-width:none] gap-1 overflow-x-auto rounded-[1.5rem] border border-secondary/20 bg-card/96 p-2 shadow-card [&::-webkit-scrollbar]:hidden"
          aria-label={t("child.tabsLabel")}
        >
          {tabIds.map((tab) => {
            const Icon = tabIcons[tab];
            const active = activeTab === tab;
            return (
              <Link
                key={tab}
                href={{ pathname: "/parent/children", query: { student: selected.id, view: tab } }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 min-w-32 flex-1 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                  active
                    ? "bg-[#f7ecd4] text-[#8a5b12] dark:bg-accent dark:text-secondary"
                    : "text-muted-foreground hover:bg-accent/45 hover:text-primary",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {t(`tabs.${tab}`)}
              </Link>
            );
          })}
        </nav>

        <main className="mt-5" aria-live="polite">
          {activeTab === "overview" ? (
            <ChildOverviewPanel locale={locale} details={details} dashboard={dashboard} />
          ) : null}
          {activeTab === "progress" ? (
            <ChildProgressPanel
              locale={locale}
              details={details}
              dashboard={dashboard}
              plan={plan}
            />
          ) : null}
          {activeTab === "attendance" ? (
            <AttendancePanel
              locale={locale}
              attendance={details.attendance}
              timezone={details.child.timezone}
            />
          ) : null}
          {activeTab === "reports" ? (
            <ChildReportsPanel locale={locale} reports={details.reports} />
          ) : null}
          {activeTab === "schedule" ? (
            <ChildSchedulePanel
              locale={locale}
              schedule={details.schedule}
              timezone={details.child.timezone}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
