import { FileDown, Mail, Phone, Search, UserRoundCheck, UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  inviteAcceptedTeacherAction,
  reviewTeacherApplicationAction,
} from "@/lib/teacher-applications/actions";
import { getTeacherApplications } from "@/lib/teacher-applications/management";

type Props = {
  locale: AppLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function TeacherApplicationSection({ locale, searchParams }: Props) {
  const [workspace, t, rawQuery] = await Promise.all([
    getTeacherApplications(locale, searchParams),
    getTranslations({ locale, namespace: "teacherApplications.admin" }),
    searchParams,
  ]);
  const notice = noticeFor(rawQuery, t);

  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="teacher-applications-title">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1
          id="teacher-applications-title"
          className="text-3xl font-black text-balance text-primary sm:text-4xl"
        >
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-pretty text-muted-foreground">{t("description")}</p>
      </header>

      <div className="mt-7">
        <AuthNotice message={notice.message} success={notice.success} />
      </div>

      <form className="mt-7 grid gap-3 rounded-2xl border bg-card p-4 shadow-card sm:grid-cols-[minmax(0,1fr)_13rem_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="teacher-application-search">{t("filters.search")}</Label>
          <Input
            id="teacher-application-search"
            name="q"
            type="search"
            autoComplete="off"
            defaultValue={workspace.filters.q}
            placeholder={t("filters.searchPlaceholder")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="teacher-application-status">{t("filters.status")}</Label>
          <select
            id="teacher-application-status"
            name="status"
            defaultValue={workspace.filters.status}
            className="min-h-11 rounded-xl border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {statusValues.map((status) => (
              <option key={status} value={status}>
                {t(`statuses.${status}`)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          <Search aria-hidden="true" /> {t("filters.apply")}
        </Button>
      </form>

      {workspace.applications.length ? (
        <div className="mt-6 grid gap-4">
          {workspace.applications.map((application) => (
            <details
              key={application.id}
              className="group rounded-2xl border bg-card shadow-card open:border-secondary/45"
            >
              <summary className="flex min-h-20 cursor-pointer list-none flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg font-black break-words text-primary">
                      {application.full_name}
                    </strong>
                    <Badge variant={badgeFor(application.status)}>
                      {t(`statuses.${application.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                    {application.application_no}
                  </p>
                </div>
                <time
                  className="text-sm font-bold text-muted-foreground"
                  dateTime={application.created_at}
                >
                  {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                    new Date(application.created_at),
                  )}
                </time>
              </summary>

              <div className="grid gap-6 border-t p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)]">
                <div className="min-w-0">
                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    <Detail label={t("fields.email")} value={application.email} icon={Mail} ltr />
                    <Detail label={t("fields.phone")} value={application.phone} icon={Phone} ltr />
                    <Detail label={t("fields.gender")} value={t(`gender.${application.gender}`)} />
                    <Detail label={t("fields.specialization")} value={application.specialization} />
                    <Detail
                      label={t("fields.experienceYears")}
                      value={t("fields.years", { count: application.experience_years })}
                    />
                    <Detail
                      label={t("fields.languages")}
                      value={application.teaching_languages
                        .map((language) => t(`languages.${language}`))
                        .join("، ")}
                    />
                  </dl>
                  <section className="mt-5 rounded-2xl bg-background/65 p-4">
                    <h2 className="font-black text-primary">{t("fields.qualifications")}</h2>
                    <p className="mt-2 leading-7 whitespace-pre-wrap text-muted-foreground">
                      {application.qualifications}
                    </p>
                  </section>
                  <section className="mt-3 rounded-2xl bg-background/65 p-4">
                    <h2 className="font-black text-primary">{t("fields.availability")}</h2>
                    <p className="mt-2 leading-7 whitespace-pre-wrap text-muted-foreground">
                      {application.availability}
                    </p>
                  </section>
                  {application.cv_path ? (
                    <Button asChild variant="outline" className="mt-4">
                      <a
                        href={`/api/admin/teacher-applications/${application.id}/cv?locale=${locale}`}
                      >
                        <FileDown aria-hidden="true" /> {t("actions.downloadCv")}
                      </a>
                    </Button>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">{t("fields.noCv")}</p>
                  )}
                </div>

                <div className="grid content-start gap-4">
                  {application.status !== "rejected" && application.status !== "invited" ? (
                    <form
                      action={reviewTeacherApplicationAction.bind(null, locale)}
                      className="grid gap-4 rounded-2xl border border-secondary/25 bg-background/65 p-4"
                    >
                      <input type="hidden" name="applicationId" value={application.id} />
                      <div className="grid gap-2">
                        <Label htmlFor={`review-status-${application.id}`}>
                          {t("review.status")}
                        </Label>
                        <select
                          id={`review-status-${application.id}`}
                          name="status"
                          defaultValue={application.status}
                          className="min-h-11 rounded-xl border bg-card px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {reviewStatuses(application.status).map((status) => (
                            <option key={status} value={status}>
                              {t(`statuses.${status}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`review-notes-${application.id}`}>
                          {t("review.notes")}
                        </Label>
                        <textarea
                          id={`review-notes-${application.id}`}
                          name="internalNotes"
                          defaultValue={application.internal_notes ?? ""}
                          maxLength={5000}
                          autoComplete="off"
                          className="min-h-28 resize-y rounded-xl border bg-card px-3 py-2 leading-7 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      <AdminSubmitButton
                        label={t("actions.saveReview")}
                        pendingLabel={t("actions.saving")}
                      />
                    </form>
                  ) : null}

                  {application.status === "accepted" ? (
                    <form
                      action={inviteAcceptedTeacherAction.bind(null, locale)}
                      className="rounded-2xl border border-success/35 bg-success/8 p-4"
                    >
                      <input type="hidden" name="applicationId" value={application.id} />
                      <UserRoundCheck className="size-6 text-success" aria-hidden="true" />
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {t("invite.description")}
                      </p>
                      <div className="mt-4 [&_button]:w-full">
                        <AdminSubmitButton
                          label={t("actions.sendInvite")}
                          pendingLabel={t("actions.inviting")}
                        />
                      </div>
                    </form>
                  ) : null}
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed bg-card p-10 text-center">
          <UsersRound className="mx-auto size-9 text-secondary" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-black text-primary">{t("empty.title")}</h2>
          <p className="mt-2 text-muted-foreground">{t("empty.description")}</p>
        </div>
      )}
    </section>
  );
}

const statusValues = ["all", "new", "reviewing", "accepted", "rejected", "invited"] as const;

function reviewStatuses(status: string) {
  if (status === "new") return ["new", "reviewing", "rejected"] as const;
  if (status === "reviewing") return ["reviewing", "accepted", "rejected"] as const;
  return ["accepted"] as const;
}

function badgeFor(status: string): "default" | "destructive" | "outline" | "secondary" | "success" {
  if (status === "accepted" || status === "invited") return "success";
  if (status === "rejected") return "destructive";
  if (status === "reviewing") return "secondary";
  return "outline";
}

function Detail({
  icon: Icon,
  label,
  ltr,
  value,
}: {
  icon?: typeof Mail;
  label: string;
  ltr?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-background/55 p-3">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {Icon ? <Icon className="size-4 text-secondary" aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className="mt-1 font-bold break-words text-foreground" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}

function noticeFor(
  query: Record<string, string | string[] | undefined>,
  t: Awaited<ReturnType<typeof getTranslations<"teacherApplications.admin">>>,
) {
  const status =
    typeof query.teacherApplicationStatus === "string" ? query.teacherApplicationStatus : "";
  const error =
    typeof query.teacherApplicationError === "string" ? query.teacherApplicationError : "";
  if (status === "updated" || status === "invited") {
    return { message: t(`notices.${status}`), success: true };
  }
  const known = [
    "accept_first",
    "account_exists",
    "already_invited",
    "invalid_fields",
    "invalid_transition",
    "invite_failed",
    "not_found",
  ];
  return {
    message: error ? t(`errors.${known.includes(error) ? error : "request_failed"}`) : undefined,
    success: false,
  };
}
