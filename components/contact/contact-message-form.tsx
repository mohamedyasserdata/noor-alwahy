"use client";

import {
  BookOpenCheck,
  CalendarDays,
  CircleHelp,
  CreditCard,
  GraduationCap,
  Headphones,
  Mail,
  PhoneCall,
  Send,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";

const copy = {
  ar: {
    eyebrow: "أرسل لنا رسالة",
    title: "نحن هنا للاستماع إليك",
    description: "اكتب استفسارك وسنفتح لك البريد الرسمي للأكاديمية لإرسال الرسالة بأمان.",
    name: "الاسم الكامل",
    email: "بريدك الإلكتروني",
    phone: "رقم هاتفك (اختياري)",
    officialPhone: "هاتف الأكاديمية",
    inquiry: "نوع الاستفسار",
    message: "نص الرسالة",
    namePlaceholder: "اكتب اسمك الكامل",
    emailPlaceholder: "name@example.com",
    phonePlaceholder: "+20 100 000 0000",
    messagePlaceholder: "اكتب تفاصيل استفسارك هنا…",
    submit: "إرسال عبر البريد الرسمي",
    unavailable: "البريد الرسمي غير مفعّل حاليًا. استخدم إحدى القنوات الرسمية المتاحة.",
    helpTitle: "كيف يمكننا مساعدتك؟",
    helpDescription: "اختر الموضوع المناسب ليظهر مباشرة في نموذج الرسالة.",
    options: [
      ["enrollment", "الالتحاق والبرامج", "المسارات والباقات المتاحة"],
      ["placement", "تحديد المستوى", "اختيار نقطة البداية المناسبة"],
      ["schedule", "المواعيد والحصص", "تنظيم المواعيد والجداول"],
      ["billing", "الاشتراكات والدفع", "الباقات وطرق الدفع"],
      ["technical", "الدعم الفني", "المساعدة في استخدام المنصة"],
      ["other", "استفسار آخر", "أي موضوع آخر"],
    ],
  },
  en: {
    eyebrow: "Send us a message",
    title: "We are here to listen",
    description:
      "Write your question and we will open the academy’s official email to send it securely.",
    name: "Full name",
    email: "Your email",
    phone: "Your phone number (optional)",
    officialPhone: "Academy phone",
    inquiry: "Inquiry type",
    message: "Message",
    namePlaceholder: "Enter your full name",
    emailPlaceholder: "name@example.com",
    phonePlaceholder: "+20 100 000 0000",
    messagePlaceholder: "Write the details of your inquiry…",
    submit: "Send through official email",
    unavailable:
      "Official email is not active right now. Use one of the available official channels.",
    helpTitle: "How can we help?",
    helpDescription: "Choose a topic and it will be selected in the message form.",
    options: [
      ["enrollment", "Enrollment and programs", "Available tracks and packages"],
      ["placement", "Level placement", "Choosing the right starting point"],
      ["schedule", "Lessons and schedules", "Lesson times and calendar questions"],
      ["billing", "Subscriptions and payment", "Packages and payment methods"],
      ["technical", "Technical support", "Help using the platform"],
      ["other", "Another inquiry", "Anything else you would like to ask"],
    ],
  },
} as const;

const optionIcons = [
  BookOpenCheck,
  GraduationCap,
  CalendarDays,
  CreditCard,
  Headphones,
  CircleHelp,
] as const;

export function ContactMessageForm({
  emailHref,
  locale,
  phoneHref,
}: {
  emailHref: string | null;
  locale: AppLocale;
  phoneHref: string | null;
}) {
  const t = copy[locale];
  const [inquiry, setInquiry] = useState<string>(t.options[0][0]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailHref?.toLowerCase().startsWith("mailto:")) return;

    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const senderEmail = String(data.get("email") ?? "").trim();
    const senderPhone = String(data.get("phone") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    const selected = t.options.find(([value]) => value === inquiry)?.[1] ?? t.options[0][1];
    const destination = emailHref.slice(
      0,
      emailHref.indexOf("?") === -1 ? undefined : emailHref.indexOf("?"),
    );
    const subject = locale === "ar" ? `استفسار: ${selected}` : `Inquiry: ${selected}`;
    const body =
      locale === "ar"
        ? `الاسم: ${name}\nالبريد: ${senderEmail}\nالهاتف: ${senderPhone || "—"}\nنوع الاستفسار: ${selected}\n\n${message}`
        : `Name: ${name}\nEmail: ${senderEmail}\nPhone: ${senderPhone || "—"}\nInquiry type: ${selected}\n\n${message}`;

    window.open(
      `${destination}?${new URLSearchParams({ subject, body }).toString()}`,
      "_self",
      "noopener,noreferrer",
    );
  }

  return (
    <div className="contents" dir={locale === "ar" ? "rtl" : "ltr"}>
      <section
        id="contact-form"
        className="rounded-[1.5rem] border border-[#d5a028]/25 bg-[#fffdf8] p-6 text-start shadow-[0_22px_65px_-34px_rgba(16,31,59,.45)] sm:p-8 dark:bg-[#0c1b33]"
        aria-labelledby="contact-form-title"
      >
        <p className="text-sm font-black text-[#9b680c] dark:text-[#efc75d]">{t.eyebrow}</p>
        <h2
          id="contact-form-title"
          className="mt-2 text-3xl font-black text-[#101f3b] dark:text-[#fffaf0]"
        >
          {t.title}
        </h2>
        <p className="mt-3 leading-8 text-[#657089] dark:text-[#f5f0e6]/70">{t.description}</p>
        {phoneHref ? (
          <a
            href={phoneHref}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d5a028]/40 bg-[#fff8e8] px-4 text-sm font-black text-[#101f3b] hover:border-[#d5a028] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-[#152744] dark:text-[#fffaf0]"
          >
            <PhoneCall className="size-4 text-[#9b680c] dark:text-[#efc75d]" aria-hidden="true" />
            <span>{t.officialPhone}</span>
            <b dir="ltr">{phoneHref.replace(/^tel:/i, "")}</b>
          </a>
        ) : null}

        <form onSubmit={submit} className="mt-7 grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.name} htmlFor="contact-name" icon={UserRound}>
              <Input
                id="contact-name"
                name="name"
                autoComplete="name"
                required
                placeholder={t.namePlaceholder}
                className="min-h-12 rounded-xl bg-white dark:bg-[#07152b]"
              />
            </Field>
            <Field label={t.email} htmlFor="contact-email" icon={Mail}>
              <Input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={t.emailPlaceholder}
                className="min-h-12 rounded-xl bg-white dark:bg-[#07152b]"
              />
            </Field>
          </div>

          <Field label={t.phone} htmlFor="contact-phone" icon={PhoneCall}>
            <Input
              id="contact-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              maxLength={30}
              placeholder={t.phonePlaceholder}
              className="min-h-12 rounded-xl bg-white dark:bg-[#07152b]"
            />
          </Field>

          <Field label={t.inquiry} htmlFor="contact-inquiry" icon={CircleHelp}>
            <select
              id="contact-inquiry"
              name="inquiry"
              value={inquiry}
              onChange={(event) => setInquiry(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-input bg-white px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-[#07152b]"
            >
              {t.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.message} htmlFor="contact-message" icon={Send}>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={6}
              maxLength={2000}
              placeholder={t.messagePlaceholder}
              className="w-full resize-y rounded-xl border border-input bg-white px-4 py-3 text-sm leading-7 text-foreground shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-[#07152b]"
            />
          </Field>

          <Button
            type="submit"
            variant="gold"
            size="lg"
            disabled={!emailHref}
            className="min-h-14 w-full rounded-xl bg-linear-to-r from-[#b67b12] via-[#d5a028] to-[#b67b12] text-base shadow-[0_16px_35px_-18px_rgba(181,122,18,.8)]"
          >
            <Send aria-hidden="true" />
            {t.submit}
          </Button>
          {!emailHref ? (
            <p className="text-center text-sm font-bold text-muted-foreground">{t.unavailable}</p>
          ) : null}
        </form>
      </section>

      <section className="mt-10 xl:col-span-2 xl:mt-16" aria-labelledby="contact-help-title">
        <header className="text-center">
          <h2 id="contact-help-title" className="text-3xl font-black text-primary">
            {t.helpTitle}
          </h2>
          <p className="mt-3 text-muted-foreground">{t.helpDescription}</p>
        </header>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {t.options.map(([value, title, description], index) => {
            const Icon = optionIcons[index]!;
            const selected = inquiry === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setInquiry(value);
                  document.getElementById("contact-inquiry")?.focus();
                }}
                className={`min-h-40 rounded-[1.25rem] border p-5 text-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none ${selected ? "border-[#d5a028] bg-[#fff4d8] dark:bg-[#2f2b1b]" : "border-[#d5a028]/35 bg-[#fffdf8] hover:border-[#d5a028] dark:bg-[#13233d]"}`}
              >
                <span className="mx-auto grid size-12 place-items-center rounded-full border border-[#d5a028]/45 bg-[#fff8e8] text-[#9b680c] dark:bg-[#152744] dark:text-[#efc75d]">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="mt-4 block font-black text-[#101f3b] dark:text-[#fffaf0]">
                  {title}
                </span>
                <span className="mt-2 block text-xs leading-6 text-[#4e6077] dark:text-[#f4ead6]">
                  {description}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Field({
  children,
  htmlFor,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  htmlFor: string;
  icon: typeof Mail;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2 font-black text-primary">
        <Icon className="size-4 text-[#9b680c] dark:text-[#efc75d]" aria-hidden="true" />
        {label}
      </Label>
      {children}
    </div>
  );
}
