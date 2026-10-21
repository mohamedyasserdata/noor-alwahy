import { BadgeCheck, Ban, SearchX, ShieldAlert } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

const codeSchema = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

export default async function CertificateVerificationPage({
  params,
}: PageProps<"/[locale]/verify/[code]">) {
  const { locale, code } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await connection();
  const t = await getTranslations({ locale, namespace: "certificateVerification" });
  const parsed = codeSchema.safeParse(code);
  let result: {
    valid: boolean;
    status: string;
    student_name: string | null;
    certificate_kind: string | null;
    issued_on: string | null;
    serial_no: string | null;
  } | null = null;
  let rateLimited = false;
  if (parsed.success) {
    const supabase = await createClient();
    const response = await supabase.rpc("verify_certificate", { p_code: parsed.data });
    rateLimited = Boolean(response.error?.message.includes("rate_limited"));
    result = response.data?.[0] ?? null;
  }
  const status = rateLimited
    ? "rate_limited"
    : result?.status === "valid"
      ? "valid"
      : result?.status === "revoked"
        ? "revoked"
        : "not_found";
  const Icon =
    status === "valid"
      ? BadgeCheck
      : status === "revoked"
        ? Ban
        : status === "rate_limited"
          ? ShieldAlert
          : SearchX;
  return (
    <main className="mx-auto grid min-h-[65vh] w-full max-w-3xl place-items-center px-4 py-16">
      <article className="w-full overflow-hidden border bg-card shadow-card">
        <div
          className={`h-2 ${status === "valid" ? "bg-success" : status === "revoked" ? "bg-destructive" : "bg-warning"}`}
        />
        <div className="p-6 text-center sm:p-10">
          <span
            className={`mx-auto grid size-16 place-items-center rounded-full ${status === "valid" ? "bg-success/12 text-success" : status === "revoked" ? "bg-destructive/10 text-destructive" : "bg-warning/12 text-warning"}`}
          >
            <Icon className="size-8" aria-hidden="true" />
          </span>
          <Badge
            className="mt-5"
            variant={
              status === "valid" ? "success" : status === "revoked" ? "destructive" : "warning"
            }
          >
            {t(`statuses.${status}`)}
          </Badge>
          <h1 className="mt-4 text-3xl font-black text-primary">{t(`${status}.title`)}</h1>
          <p className="mx-auto mt-3 max-w-xl leading-8 text-muted-foreground">
            {t(`${status}.description`)}
          </p>
          {result && status !== "not_found" && status !== "rate_limited" ? (
            <dl className="mx-auto mt-8 grid max-w-xl gap-3 text-start sm:grid-cols-2">
              <Item label={t("fields.student")} value={result.student_name ?? "—"} />
              <Item
                label={t("fields.kind")}
                value={
                  result.certificate_kind
                    ? t(`kinds.${result.certificate_kind}` as "kinds.memorization")
                    : "—"
                }
              />
              <Item
                label={t("fields.issuedOn")}
                value={
                  result.issued_on
                    ? new Intl.DateTimeFormat(locale, {
                        dateStyle: "long",
                        timeZone: "UTC",
                      }).format(new Date(`${result.issued_on}T00:00:00Z`))
                    : "—"
                }
              />
              <Item label={t("fields.serial")} value={result.serial_no ?? "—"} ltr />
            </dl>
          ) : null}
          <p className="mt-8 text-xs leading-6 text-muted-foreground">{t("privacy")}</p>
        </div>
      </article>
    </main>
  );
}

function Item({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-black text-primary" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
