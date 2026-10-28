import { Bell, BellRing, CalendarDays, CheckCheck, FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import {
  TeacherMetricCard,
  TeacherPageHeader,
  TeacherPanel,
} from "@/components/teacher/teacher-page-ui";
import { Badge } from "@/components/ui/badge";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/notifications/actions";
import { getNotificationCenter, type NotificationItem } from "@/lib/notifications/queries";

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

function NotificationRow({
  item,
  labels,
  locale,
}: {
  item: NotificationItem;
  labels: { markRead: string; marking: string; open: string; unread: string };
  locale: AppLocale;
}) {
  const title = locale === "ar" ? item.payload.titleAr : item.payload.titleEn;
  const fallbackTitle = locale === "ar" ? item.payload.titleEn : item.payload.titleAr;
  const body = locale === "ar" ? item.payload.bodyAr : item.payload.bodyEn;
  const fallbackBody = locale === "ar" ? item.payload.bodyEn : item.payload.bodyAr;
  return (
    <li className="grid min-w-0 gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fff0d1] text-[#a76600] dark:bg-[#493716] dark:text-[#f0c462]">
          <Bell className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-primary">{title || fallbackTitle || item.type}</h3>
            {!item.readAt ? <Badge variant="destructive">{labels.unread}</Badge> : null}
          </div>
          <p className="mt-1 text-sm break-words text-muted-foreground">{body || fallbackBody}</p>
          <time className="mt-1 block text-xs text-muted-foreground" dateTime={item.createdAt}>
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(item.createdAt),
            )}
          </time>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {!item.readAt ? (
          <form action={markNotificationReadAction.bind(null, locale, "teacher", item.id)}>
            <AdminSubmitButton
              label={labels.markRead}
              pendingLabel={labels.marking}
              variant="outline"
            />
          </form>
        ) : null}
        {item.payload.href ? (
          <Link
            href={item.payload.href.replace(/^\/(ar|en)/, "")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {labels.open}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function formatRelative(value: string, locale: AppLocale) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}
