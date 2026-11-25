import { Bell, BellRing, CalendarDays, CheckCheck, FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import {
  TeacherMetricCard,
  TeacherPageHeader,
  TeacherPanel,
} from "@/components/teacher/teacher-page-ui";
import { NotificationRow } from "@/components/notifications/notification-row";
import type { AppLocale } from "@/i18n/routing";
import { markAllNotificationsReadAction } from "@/lib/notifications/actions";
import { getNotificationCenter } from "@/lib/notifications/queries";

export async function TeacherNotificationsSection({ locale }: { locale: AppLocale }) {
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "teacherReference.notifications" }),
    getNotificationCenter(),
  ]);
  const items = data?.items ?? [];
  const unread = items.filter((item) => !item.readAt);
  const schedule = items.filter((item) => item.type === "schedule_changed");
  const instructions = items.filter((item) => item.type === "announcement");

  return (
    <section className="teacher-reference-page" aria-labelledby="teacher-notifications-title">
      <div id="teacher-notifications-title">
        <TeacherPageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          icon={Bell}
        />
      </div>

      <div className="teacher-metrics-grid mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TeacherMetricCard
          icon={BellRing}
          label={t("metrics.unread")}
          value={unread.length}
          tone="red"
        />
        <TeacherMetricCard
          icon={CalendarDays}
          label={t("metrics.sessions")}
          value={schedule.length}
        />
        <TeacherMetricCard
          icon={FileText}
          label={t("metrics.instructions")}
          value={instructions.length}
          tone="gold"
        />
        <TeacherMetricCard
          icon={CheckCheck}
          label={t("metrics.latest")}
          value={items[0] ? formatRelative(items[0].createdAt, locale) : t("emptyValue")}
          tone="green"
        />
      </div>

      <TeacherPanel
        className="mt-5"
        title={t("all")}
        action={
          unread.length ? (
            <form action={markAllNotificationsReadAction.bind(null, locale, "teacher")}>
              <AdminSubmitButton
                label={t("markAll")}
                pendingLabel={t("marking")}
                variant="outline"
              />
            </form>
          ) : null
        }
      >
        {items.length ? (
          <ol className="divide-y divide-secondary/15">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                portal="teacher"
                item={item}
                locale={locale}
                labels={{
                  markRead: t("markRead"),
                  marking: t("marking"),
                  open: t("open"),
                  unread: t("unread"),
                }}
              />
            ))}
          </ol>
        ) : (
          <div className="rounded-xl border border-dashed border-secondary/30 p-8 text-center">
            <Bell className="mx-auto size-8 text-secondary" aria-hidden="true" />
            <p className="mt-3 font-black text-primary">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p>
          </div>
        )}
      </TeacherPanel>
    </section>
  );
}

function formatRelative(value: string, locale: AppLocale) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}
