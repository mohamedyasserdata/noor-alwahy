import { Award, Download, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import type { AppLocale } from "@/i18n/routing";
import { getMyCertificates } from "@/lib/certificates/queries";

export async function StudentCertificatesSection({ locale }: { locale: AppLocale }) {
  const [t, certificates] = await Promise.all([
    getTranslations({ locale, namespace: "certificates" }),
    getMyCertificates(),
  ]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="my-certificates-title">
      <header className="border-b border-secondary/30 pb-7">
        <p className="text-sm font-black text-secondary">{t("student.eyebrow")}</p>
        <h1
          id="my-certificates-title"
          className="mt-3 text-3xl font-black text-primary sm:text-4xl"
        >
          {t("student.title")}
        </h1>
        <p className="mt-4 text-muted-foreground">{t("student.description")}</p>
      </header>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        {certificates.length ? (
          certificates.map((certificate) => {
            const payload = certificate.payload_snapshot as Record<string, unknown>;
            return (
              <article
                key={certificate.id}
                className="border-t-4 border-secondary bg-card p-5 shadow-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="grid size-12 place-items-center rounded-full bg-primary text-secondary">
                    <Award aria-hidden="true" />
                  </span>
                  <Badge variant={certificate.revoked_at ? "destructive" : "success"}>
                    {certificate.revoked_at ? t("student.revoked") : t("student.valid")}
                  </Badge>
                </div>
                <h2 className="mt-5 text-xl font-black text-primary">
                  {t(`kinds.${certificate.kind}`)}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {String(payload.achievement ?? "")}
                </p>
                <p className="mt-4 text-xs text-muted-foreground" dir="ltr">
                  {certificate.serial_no} · {date.format(new Date(certificate.issued_at))}
                </p>
                {!certificate.revoked_at ? (
                  <a
                    href={`/api/pdf/certificates/${certificate.id}`}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    {t("actions.download")}
                  </a>
                ) : (
                  <p className="mt-5 flex items-center gap-2 text-sm font-bold text-destructive">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    {t("student.revokedNotice")}
                  </p>
                )}
              </article>
            );
          })
        ) : (
          <div className="col-span-full rounded-2xl border bg-card py-14 text-center">
            <Award className="mx-auto size-10 text-secondary" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black text-primary">{t("student.emptyTitle")}</h2>
            <p className="mt-2 text-muted-foreground">{t("student.emptyDescription")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
