import { Award, BookOpenCheck, CalendarDays, Download, LockKeyhole, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  changeExamStatusAction,
  createExamAction,
  lockExamResultAction,
  saveExamResultAction,
} from "@/lib/exams/actions";
import { getExamManagementData } from "@/lib/exams/queries";

type ExamPortal = "admin" | "teacher";
type Query = Promise<Record<string, string | string[] | undefined>>;

const kinds = ["monthly", "term", "final", "juz"] as const;
const sessionTypes = ["new_memo", "revision", "recitation", "tajweed", "tafsir"] as const;
const errorKeys = ["major", "minor", "prompts", "forgot"] as const;

export async function ExamManagementSection({
  locale,
  portal,
  searchParams,
}: {
  locale: AppLocale;
  portal: ExamPortal;
  searchParams: Query;
}) {
  const [t, data, query] = await Promise.all([
    getTranslations({ locale, namespace: "exams" }),
    getExamManagementData(),
    searchParams,
  ]);
  const notice = getNotice(query, t);
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="exams-title">
      <header className="grid gap-6 border-b border-secondary/30 pb-7 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h1
            id="exams-title"
            className="text-3xl font-black text-balance text-primary sm:text-4xl"
          >
            {t("title")}
          </h1>
          <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
        </div>
        <div className="border-s-4 border-secondary bg-primary p-5 text-primary-foreground shadow-card">
          <Award className="size-5 text-secondary" aria-hidden="true" />
          <p className="mt-3 font-black">
            {t("summary", { exams: data.exams.length, results: data.results.length })}
          </p>
          <p className="mt-1 text-sm text-primary-foreground/75">{t("calculationNotice")}</p>
        </div>
      </header>

      <div className="mt-6">
        <AuthNotice message={notice.message} success={notice.success} />
      </div>

      {portal === "admin" ? (
        <form
          action={createExamAction.bind(null, locale)}
          className="mt-7 border-t-4 border-secondary bg-card p-5 shadow-card sm:p-7"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <Plus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-primary">{t("create.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("create.description")}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label={t("fields.titleAr")} name="titleAr" required />
            <Field label={t("fields.titleEn")} name="titleEn" dir="ltr" />
            <SelectField
              label={t("fields.kind")}
              name="kind"
              options={kinds.map((value) => ({ value, label: t(`kinds.${value}`) }))}
            />
            <SelectField
              label={t("fields.sessionType")}
              name="sessionType"
              options={sessionTypes.map((value) => ({ value, label: t(`sessionTypes.${value}`) }))}
            />
            <SelectField
              label={t("fields.track")}
              name="trackId"
              options={[
                { value: "", label: t("allTracks") },
                ...data.tracks.map((track) => ({
                  value: track.id,
                  label: locale === "ar" ? track.name_ar : track.name_en,
                })),
              ]}
            />
            <Field
              label={t("fields.maxScore")}
              name="maxScore"
              type="number"
              defaultValue="100"
              min="1"
              max="10000"
              step="0.01"
              required
              dir="ltr"
            />
            <Field
              label={t("fields.weight")}
              name="weight"
              type="number"
              defaultValue="1"
              min="0.01"
              max="100"
              step="0.01"
              required
              dir="ltr"
            />
            <Field label={t("fields.heldOn")} name="heldOn" type="date" required dir="ltr" />
          </div>
          <div className="mt-6 flex justify-end">
            <AdminSubmitButton label={t("actions.create")} pendingLabel={t("actions.creating")} />
          </div>
        </form>
      ) : null}

      <div className="mt-8 grid gap-6">
        {data.exams.length === 0 ? (
          <div className="rounded-2xl border bg-card py-14 text-center">
            <BookOpenCheck className="mx-auto size-10 text-secondary" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black text-primary">{t("empty.title")}</h2>
            <p className="mt-2 text-muted-foreground">{t("empty.description")}</p>
          </div>
        ) : (
          data.exams.map((exam) => {
            const results = data.results.filter((result) => result.exam_id === exam.id);
            const criteria = data.criteria.filter((criterion) =>
              (criterion.applies_to as string[]).includes(exam.session_type),
            );
            return (
              <article key={exam.id} className="overflow-hidden border bg-card shadow-card">
                <div className="grid gap-4 border-b bg-accent/30 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-7">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          exam.status === "open"
                            ? "success"
                            : exam.status === "closed"
                              ? "outline"
                              : "warning"
                        }
                      >
                        {t(`statuses.${exam.status}`)}
                      </Badge>
                      <Badge variant="secondary">{t(`kinds.${exam.kind}`)}</Badge>
                    </div>
                    <h2 className="mt-3 text-2xl font-black text-primary">
                      {locale === "ar" || !exam.title_en ? exam.title_ar : exam.title_en}
                    </h2>
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="size-4" aria-hidden="true" />
                      {formatter.format(new Date(`${exam.held_on}T12:00:00`))} ·{" "}
                      {t("maximum", { score: exam.max_score })}
                    </p>
                  </div>
                  {portal === "admin" && exam.status !== "closed" ? (
                    <form action={changeExamStatusAction.bind(null, locale)}>
                      <input type="hidden" name="examId" value={exam.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={exam.status === "draft" ? "open" : "closed"}
                      />
                      <AdminSubmitButton
                        variant="outline"
                        label={exam.status === "draft" ? t("actions.open") : t("actions.close")}
                        pendingLabel={t("actions.updating")}
                      />
                    </form>
                  ) : null}
                </div>

                {exam.status === "open" ? (
                  <form
                    action={saveExamResultAction.bind(null, locale, portal)}
                    className="border-b p-5 sm:p-7"
                  >
                    <input type="hidden" name="examId" value={exam.id} />
                    <h3 className="font-black text-primary">{t("entry.title")}</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <SelectField
                        label={t("fields.student")}
                        name="studentId"
                        required
                        options={data.students.map((student) => ({
                          value: student.id,
                          label: student.full_name,
                        }))}
                        placeholder={t("fields.chooseStudent")}
                      />
                      {criteria.map((criterion) => (
                        <Field
                          key={criterion.code}
                          label={locale === "ar" ? criterion.name_ar : criterion.name_en}
                          name={`score:${criterion.code}`}
                          type="number"
                          min="1"
                          max="5"
                          step="1"
                          required
                          dir="ltr"
                        />
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                      {errorKeys.map((key) => (
                        <Field
                          key={key}
                          label={t(`errorsCount.${key}`)}
                          name={key}
                          type="number"
                          min="0"
                          max="999"
                          step="1"
                          defaultValue="0"
                          required
                          dir="ltr"
                        />
                      ))}
                    </div>
                    <div className="mt-5 flex justify-end">
                      <AdminSubmitButton
                        label={t("actions.saveResult")}
                        pendingLabel={t("actions.savingResult")}
                      />
                    </div>
                  </form>
                ) : null}

                <div className="p-5 sm:p-7">
                  <h3 className="font-black text-primary">{t("results.title")}</h3>
                  {results.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">{t("results.empty")}</p>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      {results.map((result) => (
                        <div
                          key={result.id}
                          className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                        >
                          <div>
                            <p className="font-black text-primary">
                              {result.student?.full_name ?? t("unknownStudent")}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {t("results.score", {
                                total: result.total,
                                maximum: exam.max_score,
                                percentage: result.percentage,
                              })}
                            </p>
                          </div>
                          <Badge variant={result.is_locked ? "success" : "warning"}>
                            {result.is_locked ? <LockKeyhole aria-hidden="true" /> : null}
                            {result.is_locked ? t("locked") : t(`grades.${result.grade}`)}
                          </Badge>
                          {portal === "admin" && !result.is_locked ? (
                            <form action={lockExamResultAction.bind(null, locale)}>
                              <input type="hidden" name="resultId" value={result.id} />
                              <AdminSubmitButton
                                variant="outline"
                                label={t("actions.lock")}
                                pendingLabel={t("actions.locking")}
                              />
                            </form>
                          ) : null}
                          {result.is_locked ? (
                            <a
                              href={`/api/pdf/exams/${result.student_id}?locale=${locale}`}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Download className="size-4" aria-hidden="true" />
                              {t("actions.downloadReport")}
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  const id = `exam-${name.replace(":", "-")}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} {...props} />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  options: { value: string; label: string | null }[];
  placeholder?: string;
  required?: boolean;
}) {
  const id = `exam-${name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue=""
        className="min-h-11 rounded-lg border bg-background px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type Translation = Awaited<ReturnType<typeof getTranslations<"exams">>>;
function getNotice(query: Record<string, string | string[] | undefined>, t: Translation) {
  const status = typeof query.examStatus === "string" ? query.examStatus : "";
  const error = typeof query.examError === "string" ? query.examError : "";
  if (status) return { message: t(`notices.${status}` as "notices.created"), success: true };
  if (error) return { message: t(`errors.${error}` as "errors.invalid_exam"), success: false };
  return { message: undefined, success: false };
}
