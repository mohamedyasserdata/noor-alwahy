import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  ContactChannelIcon,
  getContactChannelTheme,
} from "@/components/contact/contact-channel-icon";
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
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="contact-links-title">
      <header className="mx-auto max-w-3xl text-center">
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
        <ul className="mt-12 grid gap-x-8 gap-y-7 px-1 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => {
            const external = link.url.toLowerCase().startsWith("https://");
            const theme = getContactChannelTheme(link.type);

            return (
              <li key={link.id} className="min-w-0">
                <a
                  href={link.url}
                  className={`group relative flex min-h-20 min-w-0 items-center rounded-full border-2 bg-card py-3 ps-[5.25rem] pe-4 shadow-[0_10px_28px_-24px_rgba(15,39,74,0.6)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transform-none motion-reduce:transition-none ${theme.frame}`}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                >
                  <span
                    className={`absolute start-[-0.3rem] top-1/2 grid size-[4.75rem] shrink-0 -translate-y-1/2 place-items-center rounded-full border-4 border-background shadow-[0_10px_24px_-14px_rgba(15,39,74,0.75)] ring-1 ring-border [&_svg]:size-8 ${theme.icon}`}
                  >
                    <ContactChannelIcon type={link.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-primary sm:text-base">
                      {localizedLabel(link, locale)}
                    </span>
                    <span className="mt-1 block truncate text-xs font-bold text-muted-foreground">
                      {t(`types.${link.type}` as Parameters<typeof t>[0])}
                    </span>
                  </span>
                  {external ? (
                    <ExternalLink
                      className="ms-2 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <aside className="mx-auto mt-12 max-w-3xl rounded-2xl border border-secondary/25 bg-secondary/10 p-5 text-center">
        <h2 className="font-black text-primary">{t("support.title")}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{supportHours}</p>
      </aside>
    </section>
  );
}
