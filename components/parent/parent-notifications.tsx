import { getTranslations } from "next-intl/server";
import { NotificationRow } from "@/components/notifications/notification-row";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getNotificationPage } from "@/lib/notifications/queries";
import { requireRole } from "@/lib/auth/require-role";

export async function ParentNotifications({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).page;
  const page = typeof raw === "string" && /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1;
  const [user, data, t, actions] = await Promise.all([
    requireRole("parent", locale),
    getNotificationPage(page),
    getTranslations({ locale, namespace: "notifications" }),
    getTranslations({ locale, namespace: "teacherReference.notifications" }),
  ]);
  return (
    <section className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-8">
      <h1 className="text-3xl font-black text-primary">{t("title")}</h1>
      <div className="rounded-2xl border bg-card p-5">
        {data.items.length ? (
          <ol className="divide-y">
            {data.items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                portal="parent"
                timezone={user.profile.timezone}
                locale={locale}
                labels={{
                  markRead: actions("markRead"),
                  marking: actions("marking"),
                  open: actions("open"),
                  unread: actions("unread"),
                }}
              />
            ))}
          </ol>
        ) : (
          <p>{actions("emptyTitle")}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {page > 1 && (
          <Button asChild variant="outline">
            <Link href={`/parent/notifications?page=${page - 1}`}>{t("previous")}</Link>
          </Button>
        )}
        {data.hasMore && (
          <Button asChild variant="outline">
            <Link href={`/parent/notifications?page=${page + 1}`}>{t("next")}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
