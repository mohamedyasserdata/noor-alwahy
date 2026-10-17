import type { Metadata } from "next";
import { io } from "next/cache";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routing } from "@/i18n/routing";
import { queryDatabaseApi } from "@/lib/supabase/health";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dev/supabase">): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "supabaseCheck" });

  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function SupabaseCheckPage({ params }: PageProps<"/[locale]/dev/supabase">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "supabaseCheck" });

  return (
    <main
      id="main-content"
      className="mx-auto grid min-h-svh w-full max-w-3xl content-center gap-6 px-4 py-10 sm:px-6"
    >
      <header className="grid gap-3 text-center">
        <p className="text-sm font-extrabold tracking-wide text-secondary">{t("eyebrow")}</p>
        <h1 className="text-3xl font-black tracking-tight text-balance text-primary sm:text-4xl">
          {t("pageTitle")}
        </h1>
        <p className="text-base leading-8 text-pretty text-muted-foreground">
          {t("pageDescription")}
        </p>
      </header>

      <Suspense fallback={<QueryFallback label={t("checking")} />}>
        <QueryResult
          connectedLabel={t("connected")}
          description={t("resultDescription")}
          openApiLabel={t("openApiLabel")}
          pathCountLabel={t("pathCountLabel")}
          title={t("resultTitle")}
        />
      </Suspense>
    </main>
  );
}

async function QueryResult({
  connectedLabel,
  description,
  openApiLabel,
  pathCountLabel,
  title,
}: {
  connectedLabel: string;
  description: string;
  openApiLabel: string;
  pathCountLabel: string;
  title: string;
}) {
  await io();
  const result = await queryDatabaseApi();

  return (
    <Card data-testid="supabase-query-result">
      <CardHeader>
        <Badge data-testid="supabase-status" variant="success">
          {connectedLabel}
        </Badge>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 rounded-lg border bg-background/60 p-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <dt className="text-sm font-bold text-muted-foreground">{openApiLabel}</dt>
            <dd
              className="font-mono text-lg font-black text-primary"
              data-testid="supabase-api-version"
            >
              {result.openApiVersion}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-sm font-bold text-muted-foreground">{pathCountLabel}</dt>
            <dd className="font-mono text-lg font-black text-primary">{result.exposedPathCount}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function QueryFallback({ label }: { label: string }) {
  return (
    <Card aria-busy="true">
      <CardContent className="flex min-h-40 items-center justify-center pt-5 sm:pt-6">
        <p className="font-bold text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
