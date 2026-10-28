"use client";

import { AlertTriangle, House, RefreshCw } from "lucide-react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const content = isArabic
    ? {
        eyebrow: "تعذّر تحميل هذا القسم",
        title: "البيانات غير متاحة مؤقتًا",
        description:
          "لم نتمكن من تحميل بيانات الصفحة الآن. لم يتم تغيير أو حذف أي سجل. أعد المحاولة، أو ارجع إلى لوحة المتابعة.",
        retry: "إعادة المحاولة",
        dashboard: "العودة للوحة المتابعة",
      }
    : {
        eyebrow: "This section could not be loaded",
        title: "The data is temporarily unavailable",
        description:
          "We could not load this page right now. No record was changed or deleted. Try again, or return to the administration overview.",
        retry: "Try again",
        dashboard: "Back to administration overview",
      };

  return (
    <section
      className="mx-auto grid min-h-[32rem] w-full max-w-3xl place-items-center"
      aria-labelledby="admin-error-title"
      data-error-digest={error.digest}
    >
      <div className="w-full rounded-[1.5rem] border border-destructive/25 bg-card p-7 text-center shadow-card sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-black text-destructive">{content.eyebrow}</p>
        <h1 id="admin-error-title" className="mt-2 text-2xl font-black text-primary sm:text-3xl">
          {content.title}
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">
          {content.description}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" variant="gold" onClick={reset}>
            <RefreshCw aria-hidden="true" />
            {content.retry}
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/dashboard">
              <House aria-hidden="true" />
              {content.dashboard}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
