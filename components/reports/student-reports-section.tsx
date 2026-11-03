import { Download, FileCheck2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getStudentPublishedReports } from "@/lib/reports/student-queries";

export async function StudentReportsSection({ locale }: { locale: AppLocale }) {
  const reports = await getStudentPublishedReports();
  const ar = locale === "ar";
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="student-reports-title">
      <header className="border-b border-secondary/20 pb-5">
        <p className="text-sm font-black text-secondary">
          {ar ? "سجلك التعليمي المعتمد" : "Your approved learning record"}
        </p>
        <h1 id="student-reports-title" className="mt-1 text-3xl font-black text-primary">
          {ar ? "التقارير المنشورة" : "Published reports"}
        </h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
          {ar
            ? "تظهر هنا فقط النسخ التي اعتمدتها الإدارة ونشرتها لك. المسودات وملاحظات المراجعة داخلية."
            : "Only versions approved and published by administration appear here. Drafts and review notes remain internal."}
        </p>
      </header>
      <div className="mt-6 grid gap-5">
        {reports.length ? (
          reports.map((report) => (
            <article key={report.id} className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-primary">
                    {report.period_type === "monthly"
                      ? ar
                        ? "التقرير الشهري"
                        : "Monthly report"
                      : ar
                        ? "التقرير الأسبوعي"
                        : "Weekly report"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {date.format(new Date(`${report.period_start}T12:00:00Z`))} —{" "}
                    {date.format(new Date(`${report.period_end}T12:00:00Z`))}
                  </p>
                </div>
                <Badge variant="success">
                  <FileCheck2 aria-hidden="true" />
                  {ar
                    ? `معتمد · الإصدار ${report.published_version}`
                    : `Approved · version ${report.published_version}`}
                </Badge>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <ReportText
                  label={ar ? "ملخص الأداء" : "Performance summary"}
                  value={report.body.summary}
                />
                <ReportText
                  label={ar ? "توصية المعلم" : "Teacher recommendation"}
                  value={report.body.recommendation}
                />
              </div>
              <Button asChild variant="outline" className="mt-5">
                <Link href={`/api/pdf/reports/${report.id}?locale=${locale}`}>
                  <Download aria-hidden="true" />
                  {ar ? "عرض أو تنزيل PDF" : "View or download PDF"}
                </Link>
              </Button>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed p-10 text-center">
            <FileCheck2 className="mx-auto size-10 text-secondary" aria-hidden="true" />
            <h2 className="mt-3 text-xl font-black text-primary">
              {ar ? "لا يوجد تقرير منشور بعد" : "No published report yet"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {ar
                ? "سيظهر التقرير هنا بعد اعتماده ونشره من الإدارة."
                : "A report will appear here after administration approves and publishes it."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ReportText({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-accent/30 p-4">
      <h3 className="font-black text-primary">{label}</h3>
      <p className="mt-2 leading-7 text-muted-foreground">{value}</p>
    </div>
  );
}
