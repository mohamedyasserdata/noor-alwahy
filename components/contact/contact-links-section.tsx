import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ContactChannelIcon } from "@/components/contact/contact-channel-icon";
import type { AppLocale } from "@/i18n/routing";
import { getPublicContactLinks, type ContactLink } from "@/lib/contact-links/get-contact-links";
import { getPublicAppSettings } from "@/lib/settings/public-settings";

type ContactLinksSectionProps = {
  locale: AppLocale;
};

function localizedLabel(link: ContactLink, locale: AppLocale) {
  return locale === "en" && link.labelEn ? link.labelEn : link.labelAr;
}

export async function ContactLinksSection({ locale }: ContactLinksSectionProps) {
  const [links, settings, t] = await Promise.all([
    getPublicContactLinks(),
    getPublicAppSettings(),
    getTranslations({ locale, namespace: "contactLinks.public" }),
  ]);
  const supportHours = locale === "ar" ? settings.supportHours.ar : settings.supportHours.en;

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="contact-links-title">
      <header className="max-w-3xl">
        <p className="mb-3 inline-flex min-h-8 items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 text-xs font-extrabold tracking-wide text-primary">
          {t("eyebrow")}
        </p>
        <h1
          id="contact-links-title"
          className="text-3xl font-black text-balance text-primary sm:text-4xl"
        >
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-pretty text-muted-foreground">{t("description")}</p>
      </header>

      {links.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed bg-card p-8 text-center shadow-card">
          <div
            className="mx-auto flex w-fit items-center gap-2 rounded-full border border-secondary/25 bg-secondary/10 p-2 text-secondary [&_span]:grid [&_span]:size-10 [&_span]:place-items-center [&_span]:rounded-full [&_span]:bg-card [&_span]:shadow-card [&_svg]:size-5"
            aria-hidden="true"
          >
            {(["whatsapp", "phone", "email", "telegram"] as const).map((type) => (
              <span key={type}>
                <ContactChannelIcon type={type} />
              </span>
            ))}
          </div>
          <h2 className="mt-4 text-xl font-black text-primary">{t("empty.title")}</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("empty.description")}</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {links.map((link) => {
            const external = link.url.toLowerCase().startsWith("https://");

            return (
              <li key={link.id}>
                <a
                  href={link.url}
                  className="group flex min-h-24 items-center gap-4 rounded-2xl border bg-card p-5 shadow-card transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transform-none motion-reduce:transition-none"
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-secondary [&_svg]:size-5">
                    <ContactChannelIcon type={link.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-black text-primary">
                      {localizedLabel(link, locale)}
                    </span>
                    <span className="mt-1 block text-xs font-bold text-muted-foreground">
                      {t(`types.${link.type}` as Parameters<typeof t>[0])}
                    </span>
                  </span>
                  {external ? (
                    <ExternalLink
                      className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <aside className="mt-6 rounded-2xl border border-secondary/25 bg-secondary/10 p-5">
        <h2 className="font-black text-primary">{t("support.title")}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{supportHours}</p>
      </aside>
    </section>
  );
}
