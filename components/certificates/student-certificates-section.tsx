import { Award, Download, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { StudentPageShell } from "@/components/student/student-page-shell";
import type { AppLocale } from "@/i18n/routing";
import { getMyCertificates } from "@/lib/certificates/queries";

export async function StudentCertificatesSection({ locale }: { locale: AppLocale }) {
  const [t, certificates] = await Promise.all([
    getTranslations({ locale, namespace: "certificates" }),
    getMyCertificates(),
  ]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  return (
    <StudentPageShell
      locale={locale}
      eyebrow={t("student.eyebrow")}
      title={t("student.title")}
      description={t("student.description")}
      titleId="my-certificates-title"
      icon={Award}
    >
      <section
        className="mx-auto w-full max-w-[94rem] rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7"
        aria-label={t("student.title")}
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {certificates.length ? (
            certificates.map((certificate) => {
              const payload = certificate.payload_snapshot as Record<string, unknown>;
              return (
                <article
                  key={certificate.id}
                  className="overflow-hidden rounded-3xl border border-t-4 border-secondary/25 bg-[#fffdf8] p-5 shadow-card dark:bg-card"
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
            <div className="col-span-full rounded-3xl border border-dashed border-secondary/35 bg-[#fffaf0] py-16 text-center dark:bg-accent/20">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-secondary/12">
                <Award className="size-8 text-secondary" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-xl font-black text-primary">{t("student.emptyTitle")}</h2>
              <p className="mt-2 text-muted-foreground">{t("student.emptyDescription")}</p>
            </div>
          )}
        </div>
      </section>
    </StudentPageShell>
  );
}
