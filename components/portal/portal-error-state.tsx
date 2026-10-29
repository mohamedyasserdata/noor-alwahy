"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PortalErrorState({ locale, reset }: { locale: "ar" | "en"; reset: () => void }) {
  const ar = locale === "ar";
  return (
    <section
      className="mx-auto my-12 max-w-xl rounded-3xl border bg-card p-7 text-center shadow-card sm:p-10"
      role="alert"
    >
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-black text-primary">
        {ar ? "تعذر تحميل البيانات" : "We could not load the data"}
      </h1>
      <p className="mt-3 leading-7 text-muted-foreground">
        {ar
          ? "تحقق من اتصالك ثم أعد المحاولة. ستبقى الصفحة والابن المختار كما هما."
          : "Check your connection and try again. Your current page and selected child will be preserved."}
      </p>
      <Button className="mt-6" onClick={reset}>
        <RotateCcw aria-hidden="true" />
        {ar ? "إعادة المحاولة" : "Try again"}
      </Button>
    </section>
  );
}
