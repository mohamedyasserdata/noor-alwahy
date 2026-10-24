import { Check, Clock3, MessageCircleMore, UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ContactChannelIcon } from "@/components/contact/contact-channel-icon";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getPublicContactLinks } from "@/lib/contact-links/get-contact-links";
import { getPublicPackages } from "@/lib/public-site/packages";

type HomePackagesProps = {
  locale: AppLocale;
};

function localized(valueAr: string | null, valueEn: string | null, locale: AppLocale) {
  return locale === "en" && valueEn ? valueEn : (valueAr ?? "");
}

export async function HomePackages({ locale }: HomePackagesProps) {
  const [packages, contactLinks, t] = await Promise.all([
    getPublicPackages("ZZ"),
    getPublicContactLinks(),
    getTranslations({ locale, namespace: "publicSite.home.packages" }),
  ]);
  const whatsapp = contactLinks.find((link) => link.type === "whatsapp");
  const numberLocale = locale === "ar" ? "ar-EG-u-nu-latn" : "en-US";

  return (
    <section id="packages" className="scroll-mt-24 border-y bg-muted/35">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.55fr)] lg:items-end">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-black text-balance text-primary sm:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">{t("description")}</p>
          </div>
          <p className="border-s-2 border-secondary ps-5 text-sm leading-7 font-bold text-primary lg:justify-self-end">
            {t("pricingNote")}
          </p>
        </div>

        {packages.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed bg-card p-8 text-center shadow-card">
            <MessageCircleMore className="mx-auto size-9 text-secondary" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black text-primary">{t("empty.title")}</h3>
            <p className="mt-2 leading-7 text-muted-foreground">{t("empty.description")}</p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/contact">{t("contactAction")}</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((item) => {
              const sessions = new Intl.NumberFormat(numberLocale).format(item.sessionsPerWeek);
              const minutes = new Intl.NumberFormat(numberLocale).format(item.durationMin);

              return (
                <article
                  key={item.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-card shadow-card transition-[border-color,transform] hover:-translate-y-1 hover:border-secondary/60 motion-reduce:transform-none motion-reduce:transition-none"
                >
                  <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-primary" />
                  <div className="flex flex-1 flex-col p-7">
                    <p className="text-sm font-extrabold text-secondary">
                      {localized(item.trackNameAr, item.trackNameEn, locale) || t("generalTrack")}
                    </p>
                    <h3 className="mt-2 text-2xl leading-9 font-black text-balance text-primary">
                      {localized(item.nameAr, item.nameEn, locale)}
                    </h3>
                    <p className="mt-4 leading-8 text-muted-foreground">
                      {localized(item.descriptionAr, item.descriptionEn, locale) ||
                        t("defaultDescription")}
                    </p>

                    <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-muted/60 p-3">
                        <dt className="flex items-center gap-2 font-bold text-muted-foreground">
                          <UsersRound className="size-4" aria-hidden="true" />
                          {t("sessions")}
                        </dt>
                        <dd className="mt-2 font-black text-primary">
                          {t("sessionsValue", { count: sessions })}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-muted/60 p-3">
                        <dt className="flex items-center gap-2 font-bold text-muted-foreground">
                          <Clock3 className="size-4" aria-hidden="true" />
                          {t("duration")}
                        </dt>
                        <dd className="mt-2 font-black text-primary">
                          {t("durationValue", { minutes })}
                        </dd>
                      </div>
                    </dl>

                    {item.features.length > 0 ? (
                      <ul className="mt-6 grid gap-2.5">
                        {item.features.map((feature, index) => (
                          <li
                            key={`${item.id}-${index}`}
                            className="flex gap-3 text-sm leading-7 text-foreground"
                          >
                            <Check
                              className="mt-1 size-4 shrink-0 text-success"
                              aria-hidden="true"
                            />
                            <span>{locale === "en" && feature.en ? feature.en : feature.ar}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="mt-auto pt-8">
                      {whatsapp ? (
                        <Button
                          asChild
                          size="lg"
                          className="w-full bg-[#128C7E] text-white hover:bg-[#0f766e]"
                        >
                          <a href={whatsapp.url} target="_blank" rel="noopener noreferrer">
                            <ContactChannelIcon type="whatsapp" />
                            {t("whatsappAction")}
                          </a>
                        </Button>
                      ) : (
                        <Button asChild size="lg" className="w-full">
                          <Link href="/contact">
                            <MessageCircleMore aria-hidden="true" />
                            {t("contactAction")}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
