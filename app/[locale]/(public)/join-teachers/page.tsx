import type { Metadata } from "next";
import { Award, CalendarClock, ShieldCheck } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { TeacherApplicationForm } from "@/components/applications/teacher-application-form";
import { routing } from "@/i18n/routing";
import { localizedMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/join-teachers">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "teacherApplications.meta" });
  return localizedMetadata({
    locale,
    path: "/join-teachers",
    title: t("title"),
    description: t("description"),
  });
}

export default async function JoinTeachersPage({ params }: PageProps<"/[locale]/join-teachers">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "teacherApplications.public" });

  return (
    <div className="bg-background pb-20">
      <section className="relative -mt-[5.7rem] overflow-hidden bg-primary pt-[9rem] text-primary-foreground">
        <div className="islamic-pattern absolute inset-0 opacity-20" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[90rem] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:items-end lg:px-12 lg:py-24">
          <header className="max-w-3xl">
            <p className="font-black text-secondary">{t("eyebrow")}</p>
            <h1 className="mt-4 text-4xl leading-tight font-black text-balance sm:text-6xl">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-9 text-pretty text-primary-foreground/78">
              {t("description")}
            </p>
          </header>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <Principle
              icon={ShieldCheck}
              title={t("principles.safe.title")}
              body={t("principles.safe.body")}
            />
            <Principle
              icon={Award}
              title={t("principles.review.title")}
              body={t("principles.review.body")}
            />
            <Principle
              icon={CalendarClock}
              title={t("principles.response.title")}
              body={t("principles.response.body")}
            />
          </ul>
        </div>
      </section>

      <div className="mx-auto mt-10 grid max-w-[82rem] gap-8 px-4 sm:px-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:px-10">
        <aside className="rounded-[1.75rem] border border-secondary/25 bg-[#fff8e8] p-6 dark:bg-accent/25">
          <h2 className="text-xl font-black text-primary">{t("before.title")}</h2>
          <ul className="mt-5 grid gap-4 text-sm leading-7 text-muted-foreground">
            <li>{t("before.items.profile")}</li>
            <li>{t("before.items.availability")}</li>
            <li>{t("before.items.invite")}</li>
          </ul>
        </aside>
        <TeacherApplicationForm
          siteKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? ""}
        />
      </div>
    </div>
  );
}

function Principle({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Award;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3 rounded-2xl border border-white/15 bg-white/8 p-4">
      <Icon className="mt-1 size-5 shrink-0 text-secondary" aria-hidden="true" />
      <div>
        <p className="font-black">{title}</p>
        <p className="mt-1 text-sm leading-6 text-primary-foreground/70">{body}</p>
      </div>
    </li>
  );
}
