import { CalendarRange, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { getTeacherCapacityForecast } from "@/lib/admin/capacity-forecast";

type Forecast = Awaited<ReturnType<typeof getTeacherCapacityForecast>>;

export function TeacherCapacityForecast({ locale, data }: { locale: AppLocale; data: Forecast }) {
  const ar = locale === "ar";
  return (
    <section
      className="mt-7 rounded-3xl border bg-card p-5 shadow-card sm:p-6"
      data-testid="teacher-capacity-forecast"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-secondary">
            <CalendarRange className="size-4" aria-hidden="true" />
            {ar ? "توقع الأربعة أسابيع القادمة" : "Next four weeks forecast"}
          </p>
          <h2 className="mt-2 text-xl font-black text-primary">
            {ar ? "سعة المعلمين مقابل الطلاب المنتظرين" : "Teacher capacity vs waiting students"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {ar
              ? "تقدير تشغيلي يعتمد السعة الحالية والتعيينات والحصص المجدولة، وليس ضمانًا للتوفر."
              : "An operational estimate based on current capacity, assignments, and scheduled sessions; not a guarantee."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={data.projectedBalance >= 0 ? "success" : "destructive"}>
            {ar ? "رصيد السعة" : "Capacity balance"}: {data.projectedBalance}
          </Badge>
          <Badge variant="outline">
            {ar ? "بانتظار التعيين" : "Waiting"}: {data.waitingStudents}
          </Badge>
        </div>
      </header>
      {data.rows.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {data.rows.map((row) => (
            <article key={row.id} className="rounded-2xl border bg-background/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-primary">{row.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {ar
                      ? `${row.scheduledSessions} حصة مجدولة خلال 28 يومًا`
                      : `${row.scheduledSessions} sessions scheduled in 28 days`}
                  </p>
                </div>
                <Badge variant={row.utilization >= 85 ? "warning" : "secondary"}>
                  {row.utilization}%
                </Badge>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-secondary"
                  style={{ width: `${Math.min(100, row.utilization)}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Users className="size-4" aria-hidden="true" />
                  {row.currentLoad}/{row.maxStudents}
                </span>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/teachers/${row.id}`}>
                    {ar ? "ملف المعلم" : "Teacher profile"}
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed p-6 text-muted-foreground">
          {ar
            ? "لا يوجد معلمون نشطون لحساب السعة."
            : "No active teachers are available for capacity forecasting."}
        </p>
      )}
    </section>
  );
}
