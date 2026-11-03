import { Bookmark, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { deleteAdminViewAction, saveAdminViewAction } from "@/lib/admin/saved-view-actions";
import { getAdminSavedViews, type AdminSavedViewPage } from "@/lib/admin/saved-views";

export async function AdminSavedViews({
  locale,
  pageKey,
  currentParams,
}: {
  locale: AppLocale;
  pageKey: AdminSavedViewPage;
  currentParams: Record<string, string>;
}) {
  const views = await getAdminSavedViews(pageKey);
  const ar = locale === "ar";
  return (
    <section
      className="mt-4 rounded-2xl border border-secondary/20 bg-card p-4 shadow-card"
      data-testid={`admin-saved-views-${pageKey}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-black text-primary">
            <Bookmark className="size-4 text-secondary" aria-hidden="true" />
            {ar ? "العروض المحفوظة" : "Saved views"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {ar
              ? "احفظ الفلاتر الحالية وافتحها من أي جهاز تسجل منه الدخول."
              : "Save the current filters and reopen them from any signed-in device."}
          </p>
        </div>
        <form action={saveAdminViewAction.bind(null, locale)} className="flex flex-wrap gap-2">
          <input type="hidden" name="pageKey" value={pageKey} />
          <input type="hidden" name="queryParams" value={JSON.stringify(currentParams)} />
          <Input
            name="name"
            required
            minLength={2}
            maxLength={80}
            aria-label={ar ? "اسم العرض" : "View name"}
            placeholder={ar ? "مثال: بانتظار التعيين…" : "Example: Awaiting assignment…"}
            className="w-52"
          />
          <Button type="submit" size="sm" variant="gold">
            {ar ? "حفظ العرض" : "Save view"}
          </Button>
        </form>
      </div>
      {views.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {views.map((view) => {
            const params = new URLSearchParams(
              Object.entries(view.query_params).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            );
            return (
              <div key={view.id} className="flex overflow-hidden rounded-lg border">
                <Button asChild variant="ghost" size="sm" className="rounded-none">
                  <Link href={`/admin/${pageKey}?${params.toString()}`}>{view.name}</Link>
                </Button>
                <form action={deleteAdminViewAction.bind(null, locale)}>
                  <input type="hidden" name="pageKey" value={pageKey} />
                  <input type="hidden" name="viewId" value={view.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="size-9 min-h-9 rounded-none border-s px-0 text-destructive"
                    aria-label={ar ? `حذف ${view.name}` : `Delete ${view.name}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </form>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
