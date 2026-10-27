import { ExternalLink, Mail, MessageCircleMore, ShieldCheck } from "lucide-react";

import { ContactChannelIcon } from "@/components/contact/contact-channel-icon";
import { ContactMessageForm } from "@/components/contact/contact-message-form";
import type { AppLocale } from "@/i18n/routing";
import { getPublicContactLinks, type ContactLink } from "@/lib/contact-links/get-contact-links";

const copy = {
  ar: {
    breadcrumb: "الرئيسية / تواصل معنا",
    title: "تواصل معنا",
    lead: "نحن هنا دائمًا لمساعدتك",
    description: "اختر القناة الرسمية المناسبة، أو أرسل استفسارك عبر البريد الإلكتروني للأكاديمية.",
    channelsEyebrow: "تواصل معنا مباشرة",
    channelsTitle: "اختر وسيلة التواصل المناسبة لك",
    channelsDescription: "نعرض هنا القنوات المفعّلة والمعتمدة فقط.",
    emptyTitle: "لا توجد قنوات منشورة حاليًا",
    emptyDescription: "ستظهر وسائل التواصل هنا فور اعتمادها من إدارة الأكاديمية.",
    official: "قناة رسمية",
    open: "فتح القناة",
    privacy: "لا ترسل كلمات المرور أو رموز المصادقة عبر قنوات التواصل.",
    types: {
      whatsapp: "واتساب",
      youtube: "يوتيوب",
      instagram: "إنستجرام",
      facebook: "فيسبوك",
      telegram: "تيليجرام",
      x: "إكس",
      email: "البريد الإلكتروني",
      phone: "الهاتف",
      tiktok: "تيك توك",
      other: "رابط رسمي",
    },
  },
  en: {
    breadcrumb: "Home / Contact us",
    title: "Contact us",
    lead: "We are always here to help",
    description:
      "Choose an official channel or send your question through the academy’s official email.",
    channelsEyebrow: "Contact us directly",
    channelsTitle: "Choose the channel that suits you",
    channelsDescription: "Only active, approved academy channels are shown here.",
    emptyTitle: "No channels are published right now",
    emptyDescription: "Official contact options will appear here once approved by the academy.",
    official: "Official channel",
    open: "Open channel",
    privacy: "Never send passwords or authentication codes through contact channels.",
    types: {
      whatsapp: "WhatsApp",
      youtube: "YouTube",
      instagram: "Instagram",
      facebook: "Facebook",
      telegram: "Telegram",
      x: "X",
      email: "Email",
      phone: "Phone",
      tiktok: "TikTok",
      other: "Official link",
    },
  },
} as const;

function localizedLabel(link: ContactLink, locale: AppLocale) {
  return locale === "en" && link.labelEn ? link.labelEn : link.labelAr;
}

function displayType(link: ContactLink) {
  const identity = `${link.labelAr} ${link.labelEn ?? ""} ${link.url}`.toLowerCase();
  return link.type === "other" && /(?:^|\W)(?:x|twitter)(?:\W|$)|x\.com/.test(identity)
    ? "x"
    : link.type;
}

export async function PublicContactPage({ locale }: { locale: AppLocale }) {
  const t = copy[locale];
  const rawLinks = await getPublicContactLinks();
  const links = Array.from(
    new Map(rawLinks.filter((link) => link.isVisible).map((link) => [link.url, link])).values(),
  );
  const emailLink = links.find(
    (link) => link.type === "email" && link.url.toLowerCase().startsWith("mailto:"),
  );
  const phoneLink = links.find(
    (link) => link.type === "phone" && link.url.toLowerCase().startsWith("tel:"),
  );

  return (
    <div data-public-contact-page>
      <style>{`body:has([data-public-contact-page]) header a[href$="/contact"]{background:#f4e3bd;color:#8b5d0b;box-shadow:inset 0 -2px 0 #d5a028}`}</style>

      <section className="relative isolate -mt-[5.7rem] min-h-[31rem] overflow-hidden border-b border-[#d5a028]/25 bg-[url('/images/public/noor-home-hero.png')] bg-cover bg-[28%_center] pt-[9rem]">
        <div className="absolute inset-0 -z-10 bg-linear-to-l from-[#fffaf0]/98 via-[#fff7e7]/91 to-[#fff4dc]/12 dark:from-[#07152b]/98 dark:via-[#07152b]/86 dark:to-[#07152b]/25" />
        <div
          className="islamic-pattern absolute inset-y-0 end-0 -z-10 w-2/3 opacity-[0.16]"
          aria-hidden="true"
        />
        <div
          className="mx-auto grid min-h-[21rem] max-w-[90rem] items-center px-5 pb-16 sm:px-8 lg:grid-cols-2 lg:px-12"
          dir="ltr"
        >
          <div aria-hidden="true" />
          <header
            data-testid="public-contact-hero-copy"
            className="max-w-2xl justify-self-end text-start"
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <p className="text-sm font-black text-[#9b680c] dark:text-[#efc75d]">{t.breadcrumb}</p>
            <h1 className="mt-4 text-5xl font-black text-[#101f3b] sm:text-6xl dark:text-[#fffaf0]">
              {t.title}
            </h1>
            <p className="mt-5 text-xl font-black text-[#9b680c] dark:text-[#efc75d]">{t.lead}</p>
            <p className="mt-3 max-w-xl text-lg leading-9 text-[#44536d] dark:text-[#f5f0e6]/75">
              {t.description}
            </p>
            <div
              className={`mt-7 flex items-center gap-3 text-[#b77c12] ${locale === "ar" ? "justify-end" : "justify-start"}`}
              aria-hidden="true"
            >
              <span className="h-px w-20 bg-current" />
              <span className="size-3 rotate-45 border-2 border-current" />
              <span className="h-px w-20 bg-current" />
            </div>
          </header>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-12 max-w-[90rem] px-4 pb-20 sm:px-6 lg:px-10">
        <div className="grid items-start gap-6 xl:grid-cols-[1.05fr_.95fr]" dir="ltr">
          <section
            className="islamic-pattern relative overflow-hidden rounded-[1.5rem] border border-[#d5a028]/70 bg-[#101f3b] p-6 text-start text-white shadow-[0_26px_70px_-34px_rgba(16,31,59,.85)] sm:p-8"
            aria-labelledby="contact-channels-title"
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <div className="absolute inset-0 bg-[#101f3b]/92" aria-hidden="true" />
            <div className="relative">
              <p className="text-sm font-black text-[#efc75d]">{t.channelsEyebrow}</p>
              <h2 id="contact-channels-title" className="mt-2 text-3xl font-black">
                {t.channelsTitle}
              </h2>
              <p className="mt-3 text-[#f5f0e6]/70">{t.channelsDescription}</p>

              {links.length ? (
                <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                  {links.map((link) => {
                    const type = displayType(link);
                    const external = link.url.toLowerCase().startsWith("https://");
                    return (
                      <li key={link.id}>
                        <a
                          href={link.url}
                          target={external ? "_blank" : undefined}
                          rel={external ? "noopener noreferrer" : undefined}
                          className="group flex min-h-44 flex-col items-center justify-center rounded-[1.15rem] border border-[#d5a028]/75 bg-[#07152b]/72 p-5 text-center transition-colors hover:bg-[#152b4e] focus-visible:ring-2 focus-visible:ring-[#efc75d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101f3b] focus-visible:outline-none"
                        >
                          <span className="grid size-14 place-items-center rounded-full border border-[#efc75d] bg-linear-to-br from-[#efc75d] via-[#d5a028] to-[#9c6708] text-[#101f3b] shadow-[0_10px_28px_-12px_rgba(213,160,40,.8)] [&_svg]:size-7">
                            <ContactChannelIcon type={type} />
                          </span>
                          <span className="mt-4 font-black">{localizedLabel(link, locale)}</span>
                          <span className="mt-1 text-xs text-[#f5f0e6]/65">
                            {t.types[type as keyof typeof t.types] ?? t.official}
                          </span>
                          <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#efc75d]">
                            {t.open}
                            {external ? (
                              <ExternalLink className="size-3.5" aria-hidden="true" />
                            ) : (
                              <Mail className="size-3.5" aria-hidden="true" />
                            )}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-8 rounded-2xl border border-dashed border-[#d5a028]/55 bg-[#07152b]/65 p-8 text-center">
                  <MessageCircleMore
                    className="mx-auto size-10 text-[#efc75d]"
                    aria-hidden="true"
                  />
                  <h3 className="mt-4 text-xl font-black">{t.emptyTitle}</h3>
                  <p className="mt-2 leading-7 text-[#f5f0e6]/65">{t.emptyDescription}</p>
                </div>
              )}

              <p className="mt-7 flex items-start gap-2 border-t border-[#d5a028]/25 pt-5 text-sm leading-7 text-[#f5f0e6]/65">
                <ShieldCheck className="mt-1 size-4 shrink-0 text-[#efc75d]" aria-hidden="true" />
                {t.privacy}
              </p>
            </div>
          </section>

          <ContactMessageForm
            locale={locale}
            emailHref={emailLink?.url ?? null}
            phoneHref={phoneLink?.url ?? null}
          />
        </div>
      </div>
    </div>
  );
}
