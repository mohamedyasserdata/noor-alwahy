import { getTranslations } from "next-intl/server";
import { notificationTitle } from "@/lib/notifications/title";
import { Bell } from "lucide-react";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { markNotificationReadAction } from "@/lib/notifications/actions";
import type { NotificationItem } from "@/lib/notifications/queries";

export async function NotificationRow({
  item,
  portal,
  labels,
  timezone,
  locale,
}: {
  portal: "teacher" | "parent";
  item: NotificationItem;
  labels: { markRead: string; marking: string; open: string; unread: string };
  locale: AppLocale;
  timezone?: string;
}) {
  const t = await getTranslations({ locale, namespace: "notifications" });
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
            <h3 className="font-black text-primary">
              {title || fallbackTitle || notificationTitle(item.type, t)}
            </h3>
            {!item.readAt ? <Badge variant="destructive">{labels.unread}</Badge> : null}
          </div>
          <p className="mt-1 text-sm break-words text-muted-foreground">{body || fallbackBody}</p>
          <time className="mt-1 block text-xs text-muted-foreground" dateTime={item.createdAt}>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: timezone,
            }).format(new Date(item.createdAt))}
          </time>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {!item.readAt ? (
          <form action={markNotificationReadAction.bind(null, locale, portal, item.id)}>
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
