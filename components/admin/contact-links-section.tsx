import { Link2, Plus, Settings2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { ContactChannelIcon } from "@/components/contact/contact-channel-icon";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  createContactLinkAction,
  deleteContactLinkAction,
  updateContactLinkAction,
} from "@/lib/contact-links/actions";
import { getContactLinks } from "@/lib/contact-links/get-contact-links";
import { contactLinkTypes } from "@/lib/validators/contact-links";

type ContactLinksAdminSectionProps = {
  locale: AppLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  embedded?: boolean;
};

const selectClassName =
  "h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export async function ContactLinksAdminSection({
  locale,
  searchParams,
  embedded = false,
}: ContactLinksAdminSectionProps) {
  const [query, links, t] = await Promise.all([
    searchParams,
    getContactLinks(),
    getTranslations({ locale, namespace: "contactLinks.admin" }),
  ]);
  const notice = getNotice(query, t);

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="contact-admin-title">
      <header className="max-w-3xl">
        <p className="mb-3 inline-flex min-h-8 items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 text-xs font-extrabold tracking-wide text-primary">
          {t("eyebrow")}
        </p>
        {embedded ? (
          <h2
            id="contact-admin-title"
            className="text-2xl font-black text-balance text-primary sm:text-3xl"
          >
            {t("title")}
          </h2>
        ) : (
          <h1
            id="contact-admin-title"
            className="text-3xl font-black text-balance text-primary sm:text-4xl"
          >
            {t("title")}
          </h1>
        )}
        <p className="mt-4 leading-8 text-pretty text-muted-foreground">{t("description")}</p>
      </header>

      <div className="mt-7">
        <AuthNotice message={notice.message} success={notice.success} />
      </div>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(19rem,0.7fr)_minmax(0,1.3fr)]">
        <article className="rounded-3xl border bg-card p-6 shadow-card sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary text-secondary">
              <Plus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-primary">{t("create.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("create.description")}</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-secondary/25 bg-secondary/8 p-4">
            <p className="text-sm font-black text-primary">{t("create.supported")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {contactLinkTypes
                .filter((type) => type !== "other")
                .map((type) => (
                  <span
                    key={type}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border bg-card px-3 text-xs font-bold text-primary [&_svg]:size-4"
                  >
                    <ContactChannelIcon type={type} />
                    {t(`types.${type}`)}
                  </span>
                ))}
            </div>
          </div>
          <ContactLinkForm locale={locale} t={t} />
        </article>

        <article className="min-w-0 rounded-3xl border bg-card p-5 shadow-card sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
              <Settings2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-primary">{t("list.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("list.count", { count: links.length })}
              </p>
            </div>
          </div>

          {links.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              <Link2 className="mx-auto mb-3 size-7 text-secondary" aria-hidden="true" />
              {t("list.empty")}
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {links.map((link) => (
                <div
                  key={link.id}
                  data-testid={`contact-link-${link.id}`}
                  className="rounded-2xl border bg-background/55 p-4 sm:p-5"
                >
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary text-secondary [&_svg]:size-4">
                      <ContactChannelIcon type={link.type} />
                    </span>
                    <p className="font-black text-primary">{link.labelAr}</p>
                    <Badge variant={link.isVisible ? "success" : "outline"}>
                      {link.isVisible ? t("visibility.visible") : t("visibility.hidden")}
                    </Badge>
                    <Badge variant="secondary">
                      {t(`types.${link.type}` as Parameters<typeof t>[0])}
                    </Badge>
                  </div>
                  <ContactLinkForm locale={locale} link={link} t={t} />
                  <form
                    action={deleteContactLinkAction.bind(null, locale)}
                    className="mt-3 border-t pt-3"
                  >
                    <input type="hidden" name="id" value={link.id} />
                    <AdminSubmitButton
                      label={t("actions.delete")}
                      pendingLabel={t("actions.deleting")}
                      variant="destructive"
                    />
                  </form>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

type Translation = Awaited<ReturnType<typeof getTranslations<"contactLinks.admin">>>;

function ContactLinkForm({
  locale,
  link,
  t,
}: {
  locale: AppLocale;
  link?: Awaited<ReturnType<typeof getContactLinks>>[number];
  t: Translation;
}) {
  const suffix = link?.id ?? "new";
  const action = link
    ? updateContactLinkAction.bind(null, locale)
    : createContactLinkAction.bind(null, locale);

  return (
    <form action={action} className="mt-5 grid gap-4">
      {link ? <input type="hidden" name="id" value={link.id} /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`contact-type-${suffix}`}>{t("fields.type")}</Label>
          <select
            id={`contact-type-${suffix}`}
            name="type"
            className={selectClassName}
            defaultValue={link?.type ?? "whatsapp"}
          >
            {contactLinkTypes.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`contact-order-${suffix}`}>{t("fields.sortOrder")}</Label>
          <Input
            id={`contact-order-${suffix}`}
            name="sortOrder"
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            defaultValue={link?.sortOrder ?? 0}
            required
          />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`contact-ar-${suffix}`}>{t("fields.labelAr")}</Label>
          <Input
            id={`contact-ar-${suffix}`}
            name="labelAr"
            dir="rtl"
            maxLength={100}
            defaultValue={link?.labelAr}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`contact-en-${suffix}`}>{t("fields.labelEn")}</Label>
          <Input
            id={`contact-en-${suffix}`}
            name="labelEn"
            dir="ltr"
            maxLength={100}
            defaultValue={link?.labelEn ?? ""}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`contact-url-${suffix}`}>{t("fields.url")}</Label>
        <Input
          id={`contact-url-${suffix}`}
          name="url"
          type="text"
          inputMode="url"
          dir="ltr"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={2048}
          placeholder="https://… / mailto:… / tel:…"
          defaultValue={link?.url}
          required
        />
        <p className="text-xs leading-6 text-muted-foreground">{t("fields.urlHint")}</p>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 text-sm font-bold text-foreground">
        <input
          name="isVisible"
          type="checkbox"
          defaultChecked={link?.isVisible ?? true}
          className="size-5 accent-primary"
        />
        {t("fields.isVisible")}
      </label>
      <AdminSubmitButton
        label={link ? t("actions.update") : t("create.action")}
        pendingLabel={link ? t("actions.updating") : t("create.pending")}
      />
    </form>
  );
}

function getNotice(query: Record<string, string | string[] | undefined>, t: Translation) {
  const status = typeof query.status === "string" ? query.status : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;
  const statusKeys = {
    created: "notices.created",
    deleted: "notices.deleted",
    updated: "notices.updated",
  } as const;
  const errorKeys = {
    invalid_fields: "errors.invalidFields",
    request_failed: "errors.requestFailed",
  } as const;

  if (status && status in statusKeys)
    return { message: t(statusKeys[status as keyof typeof statusKeys]), success: true };
  if (error && error in errorKeys)
    return { message: t(errorKeys[error as keyof typeof errorKeys]), success: false };
  return { message: undefined, success: false };
}
