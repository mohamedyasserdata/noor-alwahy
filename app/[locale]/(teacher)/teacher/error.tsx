"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function TeacherError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const ar = locale === "ar";

  return (
    <section className="mx-auto grid min-h-[28rem] max-w-2xl place-items-center px-4 text-center">
      <div className="rounded-3xl border border-secondary/25 bg-card p-7 shadow-card sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-black text-primary">
          {ar ? "تعذر تحميل هذا القسم" : "This section could not be loaded"}
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          {ar
            ? "لم يتم تغيير أو حذف أي بيانات. أعد المحاولة، أو ارجع إلى لوحة المدرس."
            : "No data was changed or deleted. Try again, or return to the teacher dashboard."}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            {ar ? "إعادة المحاولة" : "Try again"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/teacher/today">{ar ? "لوحة المدرس" : "Teacher dashboard"}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
