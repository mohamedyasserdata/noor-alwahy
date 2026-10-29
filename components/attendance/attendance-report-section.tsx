import { Activity, CalendarRange, ShieldCheck, UserRoundCheck, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { AppLocale } from "@/i18n/routing";
import { getAttendanceReport } from "@/lib/attendance/reports";
import { attendanceReportPeriods, parseAttendanceReportFilters } from "@/lib/validators/attendance";

type AttendanceReportSectionProps = {
  locale: AppLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function AttendanceReportSection({
  locale,
  searchParams,
}: AttendanceReportSectionProps) {
  const [t, params] = await Promise.all([
    getTranslations({ locale, namespace: "attendanceReports" }),
    searchParams,
  ]);
  const filters = parseAttendanceReportFilters(params);
  const requestedStudent = typeof params.student === "string" ? params.student : "";
  let rows = null;

  try {
    rows = await getAttendanceReport(filters);
  } catch {
    // The role and AAL2 boundary is enforced again inside the database RPC.
  }

  const visibleRows = requestedStudent
    ? rows?.filter((row) => row.entity_type === "student" && row.entity_id === requestedStudent)
    : rows;
  const teachers = visibleRows?.filter((row) => row.entity_type === "teacher") ?? [];
  const students = visibleRows?.filter((row) => row.entity_type === "student") ?? [];
  const scheduled =
    visibleRows?.reduce((total, row) => total + Number(row.scheduled_count), 0) ?? 0;
  const attended = visibleRows?.reduce((total, row) => total + Number(row.attended_count), 0) ?? 0;

  return (
    <section className="mx-auto w-full max-w-7xl min-w-0" aria-labelledby="attendance-report-title">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1 id="attendance-report-title" className="text-3xl font-black text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
        <Badge className="mt-4" variant="outline">
          <ShieldCheck className="size-4" aria-hidden="true" /> {t("protected")}
        </Badge>
      </header>

      <form
        action={`/${locale}/admin/attendance`}
        className="mt-8 grid min-w-0 gap-4 rounded-3xl border bg-card p-5 shadow-card sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        data-testid="attendance-report-filters"
      >
        {requestedStudent ? <input type="hidden" name="student" value={requestedStudent} /> : null}
        <label className="grid min-w-0 gap-2 text-sm font-bold" htmlFor="report-period">
          {t("filters.period")}
          <select
            id="report-period"
            name="period"
            defaultValue={filters.period}
            className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3"
          >
            {attendanceReportPeriods.map((period) => (
              <option key={period} value={period}>
                {t(`periods.${period}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-bold" htmlFor="report-anchor">
          {t("filters.anchor")}
          <Input id="report-anchor" name="anchor" type="date" defaultValue={filters.anchor} />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-primary px-6 font-black text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {t("filters.apply")}
        </button>
      </form>

      {rows === null ? (
        <Alert className="mt-6" variant="warning">
          {t("error")}
        </Alert>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={CalendarRange} label={t("metrics.scheduled")} value={scheduled} />
            <Metric icon={Activity} label={t("metrics.attended")} value={attended} />
            <Metric icon={UserRoundCheck} label={t("metrics.teachers")} value={teachers.length} />
            <Metric icon={Users} label={t("metrics.students")} value={students.length} />
          </div>

          <div className="mt-8 grid min-w-0 gap-8">
            <ReportGroup rows={teachers} title={t("groups.teachers")} t={t} />
            <ReportGroup rows={students} title={t("groups.students")} t={t} />
          </div>
        </>
      )}
    </section>
  );
}

type ReportRow = NonNullable<Awaited<ReturnType<typeof getAttendanceReport>>>[number];
type Translator = Awaited<ReturnType<typeof getTranslations>>;
type IconComponent = typeof Activity;

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent;
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-3xl border bg-card p-5 shadow-card">
      <Icon className="size-5 text-secondary" aria-hidden="true" />
      <p className="mt-4 text-3xl font-black text-primary tabular-nums">{value}</p>
      <p className="mt-1 text-sm font-bold text-muted-foreground">{label}</p>
    </article>
  );
}

function ReportGroup({ rows, title, t }: { rows: ReportRow[]; title: string; t: Translator }) {
  return (
    <section className="min-w-0" aria-label={title}>
      <h2 className="text-xl font-black text-primary">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed p-6 text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div className="mt-4 max-w-full overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full min-w-160 text-start text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-black">{t("table.name")}</th>
                <th className="px-4 py-3 text-start font-black">{t("table.scheduled")}</th>
                <th className="px-4 py-3 text-start font-black">{t("table.attended")}</th>
                <th className="px-4 py-3 text-start font-black">{t("table.absent")}</th>
                <th className="px-4 py-3 text-start font-black">{t("table.adherence")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={`${row.entity_type}-${row.entity_id}`}>
                  <th scope="row" className="px-4 py-4 text-start font-black text-foreground">
                    {row.entity_name}
                  </th>
                  <td className="px-4 py-4 tabular-nums">{row.scheduled_count}</td>
                  <td className="px-4 py-4 tabular-nums">{row.attended_count}</td>
                  <td className="px-4 py-4 tabular-nums">{row.absent_count}</td>
                  <td className="px-4 py-4 font-black text-primary tabular-nums">
                    {t("percentage", { value: row.adherence_percent })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
