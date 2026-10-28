import { CalendarClock, CircleHelp, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { TeacherPageHeader, TeacherPanel } from "@/components/teacher/teacher-page-ui";
import { Badge } from "@/components/ui/badge";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getNotificationCenter } from "@/lib/notifications/queries";

export async function TeacherChangeRequestsSection({ locale }: { locale: AppLocale }) {
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "teacherReference.requests" }),
    getNotificationCenter(),
  ]);
  const changes = (data?.items ?? []).filter((item) => item.type === "schedule_changed");

  return (
    <section className="teacher-reference-page">
      <TeacherPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        icon={CalendarClock}
      />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <TeacherPanel title={t("historyTitle")}>
          {changes.length ? (
            <ol className="divide-y divide-secondary/15">
              {changes.map((item) => (
                <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-primary">
                        {(locale === "ar" ? item.payload.titleAr : item.payload.titleEn) ??
                          t("change")}
                      </p>
                      <p className="mt-1 text-sm break-words text-muted-foreground">
                        {(locale === "ar" ? item.payload.bodyAr : item.payload.bodyEn) ?? ""}
                      </p>
                    </div>
                    <Badge variant={item.readAt ? "outline" : "warning"}>
                      {item.readAt ? t("read") : t("new")}
                    </Badge>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl border border-dashed border-secondary/30 p-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          )}
        </TeacherPanel>

        <TeacherPanel title={t("requestTitle")}>
          <div className="rounded-2xl bg-[#eef5ff] p-5 dark:bg-[#173252]">
            <ShieldCheck className="size-8 text-[#2563b8] dark:text-[#8dbcf7]" aria-hidden="true" />
            <h3 className="mt-3 font-black text-primary">{t("policyTitle")}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("policyDescription")}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/teacher/schedule"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-secondary px-5 text-sm font-black text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("openSchedule")}
            </Link>
            <Link
              href="/teacher/notifications"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-secondary/45 bg-card px-5 text-sm font-black text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <CircleHelp className="me-2 size-4" aria-hidden="true" />
              {t("openNotifications")}
            </Link>
          </div>
        </TeacherPanel>
      </div>
    </section>
  );
}
