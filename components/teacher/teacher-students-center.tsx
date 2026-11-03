import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

import { TeacherMetricCard, TeacherPageHeader } from "@/components/teacher/teacher-page-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getTeacherStudents, type TeacherStudentFilters } from "@/lib/teacher/students";

const copy = {
  ar: {
    eyebrow: "مركز متابعة الطلاب",
    title: "طلابي",
    description: "تابع طلابك المسندين، واعرف من يحتاج إجراءً، ثم افتح ملف الطالب الكامل.",
    total: "الطلاب المسندون",
    followUp: "يحتاجون متابعة",
    pending: "تقييم معلّق",
    planned: "لديهم خطة",
    search: "ابحث بالاسم أو رقم الطالب",
    filters: "تصفية الطلاب",
    allStatuses: "كل الحالات",
    active: "نشط",
    suspended: "موقوف",
    graduated: "متخرج",
    dropped: "منسحب",
    archived: "مؤرشف",
    allFollowUp: "كل حالات المتابعة",
    regular: "منتظم",
    needsFollowUp: "يحتاج متابعة",
    evaluationPending: "تقييم معلّق",
    byName: "الاسم",
    byNextSession: "أقرب حصة",
    byEvaluation: "أحدث تقييم",
    apply: "تطبيق",
    clear: "مسح",
    student: "الطالب",
    level: "المسار والمستوى",
    nextSession: "الحصة القادمة",
    plan: "خطة الحفظ",
    evaluation: "آخر تقييم",
    status: "المتابعة",
    noLevel: "لم يحدد المستوى",
    noSession: "لا توجد حصة قادمة",
    noPlan: "الخطة غير معدة",
    noEvaluation: "لا يوجد تقييم مقفل",
    achieved: "{done} من {target} صفحة هذا الأسبوع",
    openProfile: "فتح الملف",
    openPlan: "الخطة",
    emptyTitle: "لا يوجد طلاب مطابقون",
    emptyDescription: "غيّر البحث أو الفلاتر. لن تظهر هنا إلا الحسابات المسندة إليك.",
    previous: "السابق",
    next: "التالي",
    page: "صفحة {page} من {count}",
    resultCount: "{count} طالب",
  },
  en: {
    eyebrow: "Student follow-up center",
    title: "My students",
    description:
      "Monitor assigned students, spot required actions, and open each complete profile.",
    total: "Assigned students",
    followUp: "Need follow-up",
    pending: "Evaluation pending",
    planned: "With a plan",
    search: "Search by name or student number",
    filters: "Filter students",
    allStatuses: "All statuses",
    active: "Active",
    suspended: "Suspended",
    graduated: "Graduated",
    dropped: "Dropped",
    archived: "Archived",
    allFollowUp: "All follow-up states",
    regular: "On track",
    needsFollowUp: "Needs follow-up",
    evaluationPending: "Evaluation pending",
    byName: "Name",
    byNextSession: "Next session",
    byEvaluation: "Latest evaluation",
    apply: "Apply",
    clear: "Clear",
    student: "Student",
    level: "Track and level",
    nextSession: "Next session",
    plan: "Memorization plan",
    evaluation: "Latest evaluation",
    status: "Follow-up",
    noLevel: "Level not set",
    noSession: "No upcoming session",
    noPlan: "Plan not configured",
    noEvaluation: "No locked evaluation",
    achieved: "{done} of {target} pages this week",
    openProfile: "Open profile",
    openPlan: "Plan",
    emptyTitle: "No matching students",
    emptyDescription: "Change the search or filters. Only students assigned to you appear here.",
    previous: "Previous",
    next: "Next",
    page: "Page {page} of {count}",
    resultCount: "{count} students",
  },
} as const;

type Props = {
  locale: AppLocale;
  filters: TeacherStudentFilters;
};

export async function TeacherStudentsCenter({ locale, filters }: Props) {
  const text = copy[locale];
  const data = await getTeacherStudents(filters);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section
      className="teacher-reference-page"
      aria-labelledby="teacher-students-title"
      data-testid="teacher-students-center"
    >
      <div id="teacher-students-title">
        <TeacherPageHeader
          eyebrow={text.eyebrow}
          title={text.title}
          description={text.description}
          icon={UsersRound}
        />
      </div>

      <div className="teacher-metrics-grid mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4 [&_.teacher-metric-card]:min-h-0 [&_.teacher-metric-card]:flex-col [&_.teacher-metric-card]:items-start [&_.teacher-metric-card]:gap-2 [&_.teacher-metric-card]:p-3 sm:[&_.teacher-metric-card]:min-h-28 sm:[&_.teacher-metric-card]:flex-row sm:[&_.teacher-metric-card]:items-center sm:[&_.teacher-metric-card]:gap-4 sm:[&_.teacher-metric-card]:p-5">
        <TeacherMetricCard icon={UsersRound} label={text.total} value={data.total} tone="blue" />
        <TeacherMetricCard
          icon={CircleAlert}
          label={text.followUp}
          value={data.summary.followUp}
          tone="red"
        />
        <TeacherMetricCard
          icon={Sparkles}
          label={text.pending}
          value={data.summary.pending}
          tone="gold"
        />
        <TeacherMetricCard
          icon={UserRoundCheck}
          label={text.planned}
          value={data.summary.planned}
          tone="green"
        />
      </div>

      <form
        method="get"
        className="mt-5 rounded-2xl border border-secondary/25 bg-card p-4 shadow-card sm:p-5"
        aria-label={text.filters}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1.5fr)_repeat(3,minmax(10rem,1fr))_auto]">
          <label className="relative block">
            <span className="sr-only">{text.search}</span>
            <Search
              className="pointer-events-none absolute start-3 top-3.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder={text.search}
              className="ps-10"
            />
          </label>
          <FilterSelect name="status" defaultValue={filters.status ?? "all"} label={text.filters}>
            <option value="all">{text.allStatuses}</option>
            <option value="active">{text.active}</option>
            <option value="suspended">{text.suspended}</option>
            <option value="graduated">{text.graduated}</option>
            <option value="dropped">{text.dropped}</option>
            <option value="archived">{text.archived}</option>
          </FilterSelect>
          <FilterSelect
            name="followUp"
            defaultValue={filters.followUp ?? "all"}
            label={text.status}
          >
            <option value="all">{text.allFollowUp}</option>
            <option value="regular">{text.regular}</option>
            <option value="needs_follow_up">{text.needsFollowUp}</option>
            <option value="evaluation_pending">{text.evaluationPending}</option>
          </FilterSelect>
          <FilterSelect name="sort" defaultValue={filters.sort ?? "name"} label={text.filters}>
            <option value="name">{text.byName}</option>
            <option value="next_session">{text.byNextSession}</option>
            <option value="recent_evaluation">{text.byEvaluation}</option>
          </FilterSelect>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              <SlidersHorizontal aria-hidden="true" />
              {text.apply}
            </Button>
            <Button asChild type="button" variant="ghost" className="px-3">
              <Link href="/teacher/students">{text.clear}</Link>
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-primary">{text.student}</h2>
        <Badge variant="secondary">{format(text.resultCount, { count: data.total })}</Badge>
      </div>

      {data.items.length ? (
        <>
          <div className="mt-3 hidden overflow-x-auto rounded-2xl border bg-card shadow-card lg:block">
            <table className="w-full min-w-[64rem] text-sm">
              <thead>
                <tr>
                  {[
                    text.student,
                    text.level,
                    text.nextSession,
                    text.plan,
                    text.evaluation,
                    text.status,
                    "",
                  ].map((label, index) => (
                    <th key={`${label}-${index}`} className="px-4 py-3 text-start font-bold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((student) => (
                  <tr key={student.id} className="border-b border-secondary/15 last:border-0">
                    <td className="px-4 py-4">
                      <StudentIdentity name={student.name} number={student.number} />
                    </td>
                    <td className="px-4 py-4">
                      <Level student={student} locale={locale} fallback={text.noLevel} />
                    </td>
                    <td className="px-4 py-4">
                      {student.nextSession ? (
                        date.format(new Date(student.nextSession.scheduledAt))
                      ) : (
                        <Muted>{text.noSession}</Muted>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Plan student={student} text={text} />
                    </td>
                    <td className="px-4 py-4">
                      {student.lastEvaluation ? (
                        <strong className="text-primary tabular-nums">
                          {Math.round(Number(student.lastEvaluation.score))}%
                        </strong>
                      ) : (
                        <Muted>{text.noEvaluation}</Muted>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <FollowUp value={student.followUp} text={text} />
                    </td>
                    <td className="px-4 py-4">
                      <Button asChild size="sm">
                        <Link href={`/teacher/students/${student.id}`}>{text.openProfile}</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid gap-3 lg:hidden">
            {data.items.map((student) => (
              <article
                key={student.id}
                className="rounded-2xl border bg-card p-4 shadow-card"
                data-testid="teacher-student-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <StudentIdentity name={student.name} number={student.number} />
                  <FollowUp value={student.followUp} text={text} />
                </div>
                <dl className="mt-4 grid gap-3 border-y border-secondary/15 py-4 sm:grid-cols-2">
                  <MobileFact label={text.level}>
                    <Level student={student} locale={locale} fallback={text.noLevel} />
                  </MobileFact>
                  <MobileFact label={text.nextSession}>
                    {student.nextSession
                      ? date.format(new Date(student.nextSession.scheduledAt))
                      : text.noSession}
                  </MobileFact>
                  <MobileFact label={text.plan}>
                    <Plan student={student} text={text} />
                  </MobileFact>
                  <MobileFact label={text.evaluation}>
                    {student.lastEvaluation
                      ? `${Math.round(Number(student.lastEvaluation.score))}%`
                      : text.noEvaluation}
                  </MobileFact>
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button asChild>
                    <Link href={`/teacher/students/${student.id}`}>{text.openProfile}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/teacher/students/${student.id}?tab=plan`}>{text.openPlan}</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed bg-card/70 p-8 text-center">
          <UsersRound className="mx-auto size-10 text-secondary" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-black text-primary">{text.emptyTitle}</h2>
          <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            {text.emptyDescription}
          </p>
        </div>
      )}

      {data.pageCount > 1 ? (
        <nav
          className="mt-5 flex items-center justify-between gap-3"
          aria-label={text.page.replace("{page}", "").replace("{count}", "")}
        >
          <Button
            asChild
            variant="outline"
            size="sm"
            className={data.page <= 1 ? "pointer-events-none opacity-50" : undefined}
          >
            <Link href={pageHref(filters, data.page - 1)} aria-disabled={data.page <= 1}>
              {locale === "ar" ? <ArrowRight /> : <ArrowLeft />}
              {text.previous}
            </Link>
          </Button>
          <span className="text-sm font-bold text-muted-foreground">
            {format(text.page, { page: data.page, count: data.pageCount })}
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={data.page >= data.pageCount ? "pointer-events-none opacity-50" : undefined}
          >
            <Link
              href={pageHref(filters, data.page + 1)}
              aria-disabled={data.page >= data.pageCount}
            >
              {text.next}
              {locale === "ar" ? <ArrowLeft /> : <ArrowRight />}
            </Link>
          </Button>
        </nav>
      ) : null}
    </section>
  );
}

function FilterSelect({
  children,
  defaultValue,
  label,
  name,
}: {
  children: React.ReactNode;
  defaultValue: string;
  label: string;
  name: string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-xl border bg-background px-3 text-sm font-bold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function StudentIdentity({ name, number }: { name: string; number: string }) {
  return (
    <div className="min-w-0">
      <p className="font-black text-primary">{name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{number}</p>
    </div>
  );
}

function Level({
  student,
  locale,
  fallback,
}: {
  student: Awaited<ReturnType<typeof getTeacherStudents>>["items"][number];
  locale: AppLocale;
  fallback: string;
}) {
  if (!student.level) return <Muted>{fallback}</Muted>;
  const level =
    locale === "ar" ? student.level.nameAr : student.level.nameEn || student.level.nameAr;
  const track = student.track
    ? locale === "ar"
      ? student.track.nameAr
      : student.track.nameEn || student.track.nameAr
    : null;
  return (
    <div>
      <p className="font-bold text-foreground">{level}</p>
      {track ? <p className="text-xs text-muted-foreground">{track}</p> : null}
    </div>
  );
}

function Plan({
  student,
  text,
}: {
  student: Awaited<ReturnType<typeof getTeacherStudents>>["items"][number];
  text: (typeof copy)[AppLocale];
}) {
  if (!student.plan) return <Muted>{text.noPlan}</Muted>;
  return (
    <div className="min-w-40">
      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-secondary/20">
        <span
          className="block h-full rounded-full bg-secondary"
          style={{ width: `${Math.min(100, Number(student.plan.adherencePercent ?? 0))}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {format(text.achieved, {
          done: student.plan.weeklyAchieved,
          target: student.plan.weeklyTarget,
        })}
      </p>
    </div>
  );
}

function FollowUp({
  value,
  text,
}: {
  value: "regular" | "needs_follow_up" | "evaluation_pending";
  text: (typeof copy)[AppLocale];
}) {
  return (
    <Badge
      variant={
        value === "regular" ? "success" : value === "needs_follow_up" ? "warning" : "secondary"
      }
    >
      {value === "regular"
        ? text.regular
        : value === "needs_follow_up"
          ? text.needsFollowUp
          : text.evaluationPending}
    </Badge>
  );
}

function MobileFact({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-foreground">{children}</dd>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

function format(value: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, replacement]) => result.replace(`{${key}}`, String(replacement)),
    value,
  );
}
function pageHref(filters: TeacherStudentFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.followUp && filters.followUp !== "all") params.set("followUp", filters.followUp);
  if (filters.sort && filters.sort !== "name") params.set("sort", filters.sort);
  params.set("page", String(Math.max(1, page)));
  return `/teacher/students?${params}`;
}
