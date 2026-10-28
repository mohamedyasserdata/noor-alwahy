import { Award, Files, ImagePlus, Layers3, Play, Plus, Send, Stamp } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  cloneCertificateTemplateAction,
  createCertificateTemplateAction,
  enqueueCertificateBatchAction,
  issueCertificateAction,
  processCertificateBatchAction,
  publishCertificateTemplateAction,
  revokeCertificateAction,
  updateCertificateTemplateAction,
} from "@/lib/certificates/actions";
import { getCertificateAdminData } from "@/lib/certificates/queries";

type Query = Promise<Record<string, string | string[] | undefined>>;
const kinds = ["memorization", "excellence", "attendance", "ijazah", "juz", "other"] as const;
const styles = ["geometric", "arabesque", "minimal", "illuminated"] as const;

export async function CertificateAdminSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const [t, data, query] = await Promise.all([
    getTranslations({ locale, namespace: "certificates" }),
    getCertificateAdminData(),
    searchParams,
  ]);
  const notice = getNotice(query, t);
  const published = data.versions.filter((version) => version.status === "published");
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="certificates-title">
      <header className="grid gap-6 border-b border-secondary/30 pb-7 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h1 id="certificates-title" className="text-3xl font-black text-primary sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
        </div>
        <div className="border-s-4 border-secondary bg-primary p-5 text-primary-foreground">
          <Award className="size-5 text-secondary" aria-hidden="true" />
          <p className="mt-3 font-black">
            {t("summary", {
              templates: data.templates.length,
              certificates: data.certificates.length,
            })}
          </p>
          <p className="mt-1 text-sm text-primary-foreground/75">{t("immutableNotice")}</p>
        </div>
      </header>
      <div className="mt-6">
        <AuthNotice message={notice.message} success={notice.success} />
      </div>

      <details
        className="mt-7 border-t-4 border-secondary bg-card shadow-card"
        open={data.templates.length === 0}
      >
        <summary className="flex min-h-16 cursor-pointer items-center gap-3 px-5 font-black text-primary sm:px-7">
          <Plus className="size-5 text-secondary" aria-hidden="true" />
          {t("createTemplate")}
        </summary>
        <TemplateForm
          locale={locale}
          action={createCertificateTemplateAction.bind(null, locale)}
          t={t}
        />
      </details>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {data.templates.map((template) => {
          const versions = data.versions.filter((version) => version.template_id === template.id);
          return (
            <article key={template.id} className="border bg-card shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-accent/30 p-5">
                <div>
                  <Badge variant="secondary">{t(`kinds.${template.kind}`)}</Badge>
                  <h2 className="mt-3 text-xl font-black text-primary">
                    {locale === "ar" || !template.name_en ? template.name_ar : template.name_en}
                  </h2>
                </div>
                <Badge variant={template.is_active ? "success" : "outline"}>
                  {template.is_active ? t("active") : t("inactive")}
                </Badge>
              </div>
              <div className="grid gap-5 p-5">
                {versions.map((version) => {
                  const theme = asTheme(version.theme);
                  const signature = asSignatures(version.signatures)[0];
                  return (
                    <div key={version.id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-black text-primary">
                          {t("version", { version: version.version })}
                        </p>
                        <Badge variant={version.status === "published" ? "success" : "warning"}>
                          {t(`statuses.${version.status}`)}
                        </Badge>
                      </div>
                      <div
                        className="relative mt-4 overflow-hidden rounded-xl border-4 p-5 text-center"
                        style={{
                          borderColor: theme.accent,
                          color: theme.primary,
                          background: `linear-gradient(135deg, ${theme.accent}12, white 48%, ${theme.primary}0d)`,
                        }}
                      >
                        <Stamp
                          className="mx-auto size-8"
                          style={{ color: theme.accent }}
                          aria-hidden="true"
                        />
                        <h3 className="mt-3 font-serif text-2xl font-bold">
                          {locale === "ar" || !version.title_en
                            ? version.title_ar
                            : version.title_en}
                        </h3>
                        <p className="mt-3 text-sm leading-7 whitespace-pre-wrap">
                          {preview(
                            locale === "ar" || !version.body_en ? version.body_ar : version.body_en,
                            locale,
                          )}
                        </p>
                        {signature ? (
                          <p className="mt-5 text-xs font-bold">
                            {signature.name} · {signature.title}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {version.status === "draft" ? (
                          <form action={publishCertificateTemplateAction.bind(null, locale)}>
                            <input type="hidden" name="versionId" value={version.id} />
                            <AdminSubmitButton
                              label={t("actions.publish")}
                              pendingLabel={t("actions.publishing")}
                            />
                          </form>
                        ) : (
                          <form action={cloneCertificateTemplateAction.bind(null, locale)}>
                            <input type="hidden" name="versionId" value={version.id} />
                            <AdminSubmitButton
                              variant="outline"
                              label={t("actions.newVersion")}
                              pendingLabel={t("actions.cloning")}
                            />
                          </form>
                        )}
                      </div>
                      {version.status === "draft" ? (
                        <details className="mt-4 rounded-lg border">
                          <summary className="cursor-pointer p-3 text-sm font-bold text-primary">
                            {t("editDraft")}
                          </summary>
                          <TemplateForm
                            locale={locale}
                            action={updateCertificateTemplateAction.bind(null, locale)}
                            t={t}
                            versionId={version.id}
                            defaults={{
                              kind: template.kind,
                              nameAr: template.name_ar,
                              nameEn: template.name_en ?? "",
                              titleAr: version.title_ar,
                              titleEn: version.title_en ?? "",
                              bodyAr: version.body_ar,
                              bodyEn: version.body_en ?? "",
                              logoPath: version.logo_path ?? "",
                              sealPath: version.seal_path ?? "",
                              signerName: signature?.name ?? "",
                              signerTitle: signature?.title ?? "",
                              signaturePath: signature?.image_path ?? "",
                              style: theme.style,
                              primary: theme.primary,
                              accent: theme.accent,
                            }}
                          />
                        </details>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-8 grid gap-7 lg:grid-cols-2">
        <IssuePanel
          title={t("issueSingle.title")}
          description={t("issueSingle.description")}
          icon={<Send className="size-5" aria-hidden="true" />}
          action={issueCertificateAction.bind(null, locale)}
          t={t}
          published={published}
          students={data.students}
          multiple={false}
        />
        <IssuePanel
          title={t("issueBatch.title")}
          description={t("issueBatch.description")}
          icon={<Layers3 className="size-5" aria-hidden="true" />}
          action={enqueueCertificateBatchAction.bind(null, locale)}
          t={t}
          published={published}
          students={data.students}
          multiple
        />
      </div>

      <section className="mt-8 border bg-card p-5 shadow-card sm:p-7">
        <h2 className="flex items-center gap-2 text-xl font-black text-primary">
          <Play className="size-5 text-secondary" aria-hidden="true" />
          {t("batches.title")}
        </h2>
        <div className="mt-5 grid gap-3">
          {data.batches.length ? (
            data.batches.map((batch) => (
              <div
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div>
                  <Badge
                    variant={
                      batch.status === "completed"
                        ? "success"
                        : batch.status === "failed"
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {t(`batchStatuses.${batch.status}`)}
                  </Badge>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("batches.progress", {
                      completed: batch.completed_count,
                      failed: batch.failed_count,
                      total: batch.total_count,
                    })}
                  </p>
                </div>
                {batch.status !== "completed" ? (
                  <form action={processCertificateBatchAction.bind(null, locale)}>
                    <input type="hidden" name="batchId" value={batch.id} />
                    <AdminSubmitButton
                      variant="outline"
                      label={t("actions.processBatch")}
                      pendingLabel={t("actions.processingBatch")}
                    />
                  </form>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("batches.empty")}</p>
          )}
        </div>
      </section>

      <section className="mt-8 border bg-card p-5 shadow-card sm:p-7">
        <h2 className="flex items-center gap-2 text-xl font-black text-primary">
          <Files className="size-5 text-secondary" aria-hidden="true" />
          {t("issued.title")}
        </h2>
        <div className="mt-5 grid gap-3">
          {data.certificates.length ? (
            data.certificates.map((certificate) => (
              <div
                key={certificate.id}
                className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div>
                  <p className="font-black text-primary">
                    {certificate.student?.full_name ?? t("unknownStudent")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                    {certificate.serial_no} · {date.format(new Date(certificate.issued_at))}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {certificate.revoked_at ? (
                    <Badge variant="destructive">{t("student.revoked")}</Badge>
                  ) : (
                    <>
                      <a
                        href={`/api/pdf/certificates/${certificate.id}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-bold text-primary hover:bg-accent"
                      >
                        {t("actions.download")}
                      </a>
                      <details className="rounded-lg border">
                        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-bold text-destructive">
                          {t("actions.revoke")}
                        </summary>
                        <form
                          action={revokeCertificateAction.bind(null, locale)}
                          className="grid w-72 gap-3 border-t p-3"
                        >
                          <input type="hidden" name="certificateId" value={certificate.id} />
                          <Label htmlFor={`revoke-${certificate.id}`}>
                            {t("fields.revokeReason")}
                          </Label>
                          <textarea
                            id={`revoke-${certificate.id}`}
                            name="reason"
                            required
                            minLength={5}
                            maxLength={500}
                            className="min-h-20 rounded-lg border bg-background p-3 text-sm"
                          />
                          <AdminSubmitButton
                            variant="destructive"
                            label={t("actions.confirmRevoke")}
                            pendingLabel={t("actions.revoking")}
                            confirmation={{
                              kind: "revokeCertificate",
                              record: `${certificate.serial_no} · ${certificate.student?.full_name ?? t("unknownStudent")}`,
                              details: [{ label: "reason", fieldName: "reason" }],
                            }}
                          />
                        </form>
                      </details>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("issued.empty")}</p>
          )}
        </div>
      </section>
    </section>
  );
}

type Translation = Awaited<ReturnType<typeof getTranslations<"certificates">>>;
type TemplateDefaults = {
  kind: string;
  nameAr: string;
  nameEn: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  logoPath: string;
  sealPath: string;
  signerName: string;
  signerTitle: string;
  signaturePath: string;
  style: string;
  primary: string;
  accent: string;
};
function TemplateForm({
  action,
  t,
  versionId,
  defaults,
}: {
  locale: AppLocale;
  action: (formData: FormData) => void | Promise<void>;
  t: Translation;
  versionId?: string;
  defaults?: TemplateDefaults;
}) {
  const value = defaults ?? {
    kind: "memorization",
    nameAr: "",
    nameEn: "",
    titleAr: "شهادة تقدير",
    titleEn: "Certificate of Achievement",
    bodyAr:
      "تشهد أكاديمية نور الوحي بأن {{student_name}} قد أتم {{achievement}} بتاريخ {{issued_on}}.",
    bodyEn:
      "Noor Al-Wahy Academy certifies that {{student_name}} completed {{achievement}} on {{issued_on}}.",
    logoPath: "",
    sealPath: "",
    signerName: "",
    signerTitle: "",
    signaturePath: "",
    style: "geometric",
    primary: "#102b50",
    accent: "#d3aa45",
  };
  return (
    <form action={action} className="grid gap-5 border-t p-5 sm:p-7">
      {versionId ? <input type="hidden" name="versionId" value={versionId} /> : null}
      <input type="hidden" name="existingLogo" value={value.logoPath} />
      <input type="hidden" name="existingSeal" value={value.sealPath} />
      <input type="hidden" name="existingSignature" value={value.signaturePath} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Select
          label={t("fields.kind")}
          name="kind"
          defaultValue={value.kind}
          options={kinds.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
        />
        <Field label={t("fields.nameAr")} name="nameAr" defaultValue={value.nameAr} required />
        <Field label={t("fields.nameEn")} name="nameEn" defaultValue={value.nameEn} dir="ltr" />
        <Field label={t("fields.titleAr")} name="titleAr" defaultValue={value.titleAr} required />
        <Field label={t("fields.titleEn")} name="titleEn" defaultValue={value.titleEn} dir="ltr" />
        <Select
          label={t("fields.style")}
          name="style"
          defaultValue={value.style}
          options={styles.map((style) => ({ value: style, label: t(`styles.${style}`) }))}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TextArea label={t("fields.bodyAr")} name="bodyAr" defaultValue={value.bodyAr} />
        <TextArea label={t("fields.bodyEn")} name="bodyEn" defaultValue={value.bodyEn} dir="ltr" />
      </div>
      <p className="text-xs text-muted-foreground">{t("variablesHint")}</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FileField label={t("fields.logo")} name="logo" current={value.logoPath} />
        <FileField label={t("fields.seal")} name="seal" current={value.sealPath} />
        <FileField
          label={t("fields.signatureImage")}
          name="signature"
          current={value.signaturePath}
        />
        <Field label={t("fields.signerName")} name="signerName" defaultValue={value.signerName} />
        <Field
          label={t("fields.signerTitle")}
          name="signerTitle"
          defaultValue={value.signerTitle}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("fields.primary")}
            name="primary"
            type="color"
            defaultValue={value.primary}
          />
          <Field
            label={t("fields.accent")}
            name="accent"
            type="color"
            defaultValue={value.accent}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <AdminSubmitButton
          label={versionId ? t("actions.saveDraft") : t("actions.createTemplate")}
          pendingLabel={t("actions.saving")}
        />
      </div>
    </form>
  );
}

function IssuePanel({
  title,
  description,
  icon,
  action,
  t,
  published,
  students,
  multiple,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  t: Translation;
  published: { id: string; title_ar: string; title_en: string | null; version: number }[];
  students: { id: string; full_name: string }[];
  multiple: boolean;
}) {
  return (
    <form action={action} className="border-t-4 border-secondary bg-card p-5 shadow-card sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-primary text-secondary">
          {icon}
        </span>
        <div>
          <h2 className="text-xl font-black text-primary">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        <Select
          label={t("fields.templateVersion")}
          name="versionId"
          defaultValue=""
          required
          options={published.map((version) => ({
            value: version.id,
            label: `${version.title_ar} · v${version.version}`,
          }))}
          placeholder={t("fields.chooseTemplate")}
        />
        <Select
          label={t("fields.locale")}
          name="locale"
          defaultValue="ar"
          options={[
            { value: "ar", label: "العربية" },
            { value: "en", label: "English" },
          ]}
        />
        <div className="grid gap-2">
          <Label htmlFor={`certificate-students-${multiple}`}>
            {multiple ? t("fields.students") : t("fields.student")}
          </Label>
          <select
            id={`certificate-students-${multiple}`}
            name={multiple ? "studentIds" : "studentId"}
            multiple={multiple}
            required
            className="min-h-11 rounded-lg border bg-background px-3 py-2 text-sm"
            size={multiple ? 6 : 1}
          >
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.full_name}
              </option>
            ))}
          </select>
        </div>
        <TextArea label={t("fields.achievement")} name="achievement" defaultValue="" />
      </div>
      <div className="mt-5 flex justify-end">
        <AdminSubmitButton
          label={multiple ? t("actions.enqueueBatch") : t("actions.issue")}
          pendingLabel={t("actions.saving")}
        />
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  const id = `certificate-${name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} {...props} />
    </div>
  );
}
function TextArea({
  label,
  name,
  defaultValue,
  dir,
}: {
  label: string;
  name: string;
  defaultValue: string;
  dir?: "ltr" | "rtl";
}) {
  const id = `certificate-${name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        dir={dir}
        required
        className="min-h-28 rounded-lg border bg-background p-3 text-sm leading-7"
      />
    </div>
  );
}
function FileField({ label, name, current }: { label: string; name: string; current: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`certificate-${name}`}>{label}</Label>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm">
        <ImagePlus className="size-4" aria-hidden="true" />
        <input
          id={`certificate-${name}`}
          name={name}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="min-w-0"
        />
      </label>
      {current ? (
        <p className="truncate text-xs text-muted-foreground" dir="ltr">
          {current}
        </p>
      ) : null}
    </div>
  );
}
function Select({
  label,
  name,
  options,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`certificate-${name}`}>{label}</Label>
      <select
        id={`certificate-${name}`}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="min-h-11 rounded-lg border bg-background px-3 text-sm"
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
function asTheme(value: unknown) {
  const theme = value as Record<string, unknown>;
  return {
    style: typeof theme.style === "string" ? theme.style : "geometric",
    primary: typeof theme.primary === "string" ? theme.primary : "#102b50",
    accent: typeof theme.accent === "string" ? theme.accent : "#d3aa45",
  };
}
function asSignatures(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { name: string; title: string; image_path?: string } =>
        typeof item === "object" && item !== null && "name" in item && "title" in item,
    )
    .map((item) => ({
      name: String(item.name),
      title: String(item.title),
      ...(typeof item.image_path === "string" ? { image_path: item.image_path } : {}),
    }));
}
function preview(body: string, locale: AppLocale) {
  return body
    .replaceAll(
      "{{student_name}}",
      locale === "ar" ? "عبد الرحمن محمد عبد الله" : "Abdulrahman Mohamed Abdullah",
    )
    .replaceAll(
      "{{achievement}}",
      locale === "ar" ? "حفظ جزء عمّ بإتقان" : "Juz Amma memorization with excellence",
    )
    .replaceAll("{{issued_on}}", "2026-10-21")
    .replaceAll("{{serial_no}}", "NAW-2026-00000001");
}
function getNotice(query: Record<string, string | string[] | undefined>, t: Translation) {
  const status = typeof query.certificateStatus === "string" ? query.certificateStatus : "";
  const error = typeof query.certificateError === "string" ? query.certificateError : "";
  if (status)
    return { message: t(`notices.${status}` as "notices.template_created"), success: true };
  if (error) return { message: t(`errors.${error}` as "errors.invalid_template"), success: false };
  return { message: undefined, success: false };
}
