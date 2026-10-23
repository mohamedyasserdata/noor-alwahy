import { FileStack, ShieldCheck } from "lucide-react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { TemplatePreview } from "@/components/content-templates/template-preview";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  archiveContentTemplateAction,
  publishContentTemplateAction,
  saveContentTemplateAction,
} from "@/lib/content-templates/actions";
import {
  getContentTemplateLibrary,
  type ContentTemplateLibrary,
} from "@/lib/content-templates/queries";

type Search = Promise<Record<string, string | string[] | undefined>>;

const copy = {
  ar: {
    eyebrow: "محتوى حتمي · بلا ذكاء اصطناعي",
    title: "مكتبة القوالب المعتمدة",
    description:
      "أنشئ نسخًا عربية وإنجليزية بمتغيرات مسموحة فقط. النشر يقفل النسخة، وأي تعديل لاحق ينشئ إصدارًا جديدًا.",
    create: "قالب جديد",
    edit: "تحرير إصدار جديد",
    kind: "نوع القالب",
    kinds: { student_report: "تقرير طالب", admin_message: "رسالة إدارة", announcement: "إعلان" },
    nameAr: "اسم القالب بالعربية",
    nameEn: "اسم القالب بالإنجليزية",
    subjectAr: "العنوان بالعربية",
    subjectEn: "العنوان بالإنجليزية",
    bodyAr: "النص بالعربية",
    bodyEn: "النص بالإنجليزية",
    subjectHint: "العنوان اختياري لتقرير الطالب فقط.",
    variableHint: "استخدم المتغيرات الظاهرة بصيغة {{variable}}. لا يُسمح بـHTML أو متغيرات مجهولة.",
    save: "حفظ المسودة",
    saving: "جارٍ الحفظ…",
    publish: "مراجعة ونشر الإصدار",
    publishing: "جارٍ النشر…",
    archive: "أرشفة القالب",
    archiving: "جارٍ الأرشفة…",
    empty: "لا توجد قوالب بعد.",
    versions: "الإصدارات",
    published: "منشور وثابت",
    draft: "مسودة قابلة للتحرير",
    archived: "مؤرشف",
    feedback: {
      saved: "حُفظت مسودة القالب.",
      published: "نُشر الإصدار وأصبح غير قابل للتعديل.",
      archived: "أُرشف القالب مع بقاء نسخه السابقة.",
    },
    error: "تعذر تنفيذ الطلب. راجع الحقول والمتغيرات المسموحة.",
  },
  en: {
    eyebrow: "Deterministic content · No AI",
    title: "Approved template library",
    description:
      "Create Arabic and English versions using allowed variables only. Publishing locks a version; later edits create a new one.",
    create: "New template",
    edit: "Edit as a new version",
    kind: "Template type",
    kinds: {
      student_report: "Student report",
      admin_message: "Admin message",
      announcement: "Announcement",
    },
    nameAr: "Arabic template name",
    nameEn: "English template name",
    subjectAr: "Arabic subject",
    subjectEn: "English subject",
    bodyAr: "Arabic body",
    bodyEn: "English body",
    subjectHint: "The subject is optional for student reports only.",
    variableHint:
      "Use the shown variables as {{variable}}. HTML and unknown variables are rejected.",
    save: "Save draft",
    saving: "Saving…",
    publish: "Review and publish version",
    publishing: "Publishing…",
    archive: "Archive template",
    archiving: "Archiving…",
    empty: "No templates yet.",
    versions: "Versions",
    published: "Published and immutable",
    draft: "Editable draft",
    archived: "Archived",
    feedback: {
      saved: "Template draft saved.",
      published: "The version was published and is now immutable.",
      archived: "Template archived; previous versions remain available.",
    },
    error: "The request failed. Review the fields and allowed variables.",
  },
} as const;

export async function ContentTemplateAdmin({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Search;
}) {
  const [library, query] = await Promise.all([getContentTemplateLibrary(), searchParams]);
  const t = copy[locale];
  const editId = typeof query.edit === "string" ? query.edit : "";
  const selected = library.templates.find((template) => template.id === editId);
  const draftVersions = selected ? latestPair(library, selected.id, false) : [];
  const editVersions = draftVersions.length
    ? draftVersions
    : selected
      ? latestPair(library, selected.id, true)
      : [];
  const status = typeof query.templateStatus === "string" ? query.templateStatus : "";
  const error = typeof query.templateError === "string" ? query.templateError : "";
  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="templates-title">
      <header className="grid gap-6 border-b pb-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-sm font-black text-secondary">
            <ShieldCheck className="size-4" />
            {t.eyebrow}
          </p>
          <h1 id="templates-title" className="mt-3 text-3xl font-black text-primary sm:text-4xl">
            {t.title}
          </h1>
          <p className="mt-4 leading-8 text-muted-foreground">{t.description}</p>
        </div>
        <div className="border-s-2 border-secondary ps-5">
          <strong className="block text-4xl font-black text-primary">
            {library.templates.length}
          </strong>
          <span className="text-sm text-muted-foreground">{t.versions}</span>
        </div>
      </header>
      {status && status in t.feedback ? (
        <Alert className="mt-6" variant="success">
          {t.feedback[status as keyof typeof t.feedback]}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning">
          {t.error}
        </Alert>
      ) : null}
      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(20rem,.85fr)_minmax(0,1.5fr)]">
        <TemplateForm locale={locale} selected={selected} versions={editVersions} />
        <div className="grid content-start gap-5">
          {library.templates.length ? (
            library.templates.map((template) => (
              <TemplateCard
                key={template.id}
                locale={locale}
                template={template}
                library={library}
              />
            ))
          ) : (
            <p className="border border-dashed p-10 text-center text-muted-foreground">{t.empty}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function TemplateForm({
  locale,
  selected,
  versions,
}: {
  locale: AppLocale;
  selected?: ContentTemplateLibrary["templates"][number];
  versions: ContentTemplateLibrary["versions"];
}) {
  const t = copy[locale];
  const ar = versions.find((version) => version.locale === "ar");
  const en = versions.find((version) => version.locale === "en");
  const variables = variableNames(selected?.kind ?? "student_report");
  return (
    <form
      action={saveContentTemplateAction.bind(null, locale)}
      className="grid h-fit gap-5 border bg-card p-5 shadow-card sm:p-7"
    >
      <input type="hidden" name="templateId" value={selected?.id ?? ""} />
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center bg-primary text-secondary">
          <FileStack />
        </span>
        <h2 className="text-xl font-black text-primary">{selected ? t.edit : t.create}</h2>
      </div>
      <Field label={t.kind} id="template-kind">
        <select
          id="template-kind"
          name="kind"
          defaultValue={selected?.kind ?? "student_report"}
          disabled={Boolean(selected)}
          className="min-h-11 rounded-lg border bg-background px-3"
        >
          {Object.entries(t.kinds).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {selected ? <input type="hidden" name="kind" value={selected.kind} /> : null}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t.nameAr} name="nameAr" value={selected?.name_ar} required />
        <TextField label={t.nameEn} name="nameEn" value={selected?.name_en ?? ""} />
      </div>
      <p className="border-s-2 border-secondary ps-3 text-sm leading-6 text-muted-foreground">
        {t.variableHint}
        <br />
        <span dir="ltr">{variables.map((value) => `{{${value}}}`).join(" · ")}</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t.subjectAr} name="subjectAr" value={ar?.subject_template ?? ""} />
        <TextField label={t.subjectEn} name="subjectEn" value={en?.subject_template ?? ""} />
      </div>
      <p className="text-xs text-muted-foreground">{t.subjectHint}</p>
      <TextArea label={t.bodyAr} name="bodyAr" value={ar?.body_template ?? ""} required />
      <TextArea label={t.bodyEn} name="bodyEn" value={en?.body_template ?? ""} required />
      <AdminSubmitButton label={t.save} pendingLabel={t.saving} />
    </form>
  );
}

function TemplateCard({
  locale,
  template,
  library,
}: {
  locale: AppLocale;
  template: ContentTemplateLibrary["templates"][number];
  library: ContentTemplateLibrary;
}) {
  const t = copy[locale];
  const versions = library.versions.filter((version) => version.template_id === template.id);
  const pairs = [...new Set(versions.map((version) => version.version_no))].sort((a, b) => b - a);
  const preview =
    versions.find((version) => version.locale === locale && version.published_at) ??
    versions.find((version) => version.locale === locale);
  return (
    <article className="overflow-hidden border bg-card shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b p-5">
        <div>
          <Badge variant="secondary">{t.kinds[template.kind]}</Badge>
          <h2 className="mt-3 text-xl font-black text-primary">
            {locale === "ar" || !template.name_en ? template.name_ar : template.name_en}
          </h2>
        </div>
        <Badge variant={template.status === "published" ? "success" : "outline"}>
          {template.status === "published"
            ? t.published
            : template.status === "archived"
              ? t.archived
              : t.draft}
        </Badge>
      </header>
      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          {pairs.map((version) => {
            const published = versions.some(
              (item) => item.version_no === version && item.published_at,
            );
            return (
              <Badge key={version} variant={published ? "success" : "outline"}>
                v{version} · {published ? t.published : t.draft}
              </Badge>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={`/${locale}/admin/templates?edit=${template.id}`}>{t.edit}</a>
          </Button>
          {template.status !== "archived" && versions.some((item) => !item.published_at) ? (
            <form action={publishContentTemplateAction.bind(null, locale)}>
              <input type="hidden" name="templateId" value={template.id} />
              <AdminSubmitButton label={t.publish} pendingLabel={t.publishing} />
            </form>
          ) : null}
          {template.status !== "archived" ? (
            <form action={archiveContentTemplateAction.bind(null, locale)}>
              <input type="hidden" name="templateId" value={template.id} />
              <AdminSubmitButton label={t.archive} pendingLabel={t.archiving} variant="outline" />
            </form>
          ) : null}
        </div>
      </div>
      {preview ? (
        <TemplatePreview
          locale={locale}
          versionId={preview.id}
          variables={Object.entries(preview.variables_schema).map(([key, value]) => ({
            key,
            fallback: value.fallback,
          }))}
        />
      ) : null}
    </article>
  );
}

function latestPair(library: ContentTemplateLibrary, id: string, published: boolean) {
  const versions = library.versions.filter(
    (version) => version.template_id === id && Boolean(version.published_at) === published,
  );
  const latest = Math.max(0, ...versions.map((version) => version.version_no));
  return versions.filter((version) => version.version_no === latest);
}
function variableNames(kind: "student_report" | "admin_message" | "announcement") {
  if (kind === "student_report")
    return [
      "student_name",
      "teacher_name",
      "period_start",
      "period_end",
      "attendance_rate",
      "evaluation_average",
      "mastered_pages",
      "recommendation",
    ];
  if (kind === "admin_message")
    return ["recipient_name", "academy_name", "action_url", "reference_no"];
  return ["recipient_name", "academy_name", "country", "role"];
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
function TextField({
  label,
  name,
  value = "",
  required = false,
}: {
  label: string;
  name: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <Field label={label} id={name}>
      <Input id={name} name={name} defaultValue={value} required={required} maxLength={200} />
    </Field>
  );
}
function TextArea({
  label,
  name,
  value,
  required,
}: {
  label: string;
  name: string;
  value: string;
  required?: boolean;
}) {
  return (
    <Field label={label} id={name}>
      <textarea
        id={name}
        name={name}
        defaultValue={value}
        required={required}
        maxLength={6000}
        rows={8}
        className="min-h-40 resize-y rounded-xl border bg-background px-3 py-3 text-sm leading-7"
      />
    </Field>
  );
}
