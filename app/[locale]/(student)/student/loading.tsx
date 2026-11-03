import { getTranslations } from "next-intl/server";

export default async function StudentPortalLoading() {
  const t = await getTranslations("studentExperience.loading");

  return (
    <div
      className="mx-auto min-h-svh w-full max-w-[100rem] px-4 py-8 sm:px-6 lg:px-10"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">{t("label")}</p>
      <div className="h-28 animate-pulse rounded-3xl bg-secondary/10 motion-reduce:animate-none" />
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border bg-card motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="mt-5 h-72 animate-pulse rounded-3xl border bg-card motion-reduce:animate-none" />
    </div>
  );
}
