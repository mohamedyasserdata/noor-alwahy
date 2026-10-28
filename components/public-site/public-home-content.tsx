import {
  Award,
  BarChart3,
  BookOpenCheck,
  CalendarCheck2,
  ClipboardCheck,
  FileChartColumnIncreasing,
  GraduationCap,
  HeartHandshake,
  MonitorCheck,
  Route,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { Suspense } from "react";

import { HomePackages } from "@/components/public-site/home-packages";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getPublishedTracks } from "@/lib/public-site/tracks";

const copy = {
  ar: {
    tracks: {
      eyebrow: "المسارات التعليمية",
      title: "مسارات تبدأ من مستوى الطالب",
      description: "نختار نقطة البداية المناسبة، ثم تتدرج الخطة بوضوح مع المعلم والأسرة.",
      action: "عرض تفاصيل المسارات",
      level: "الفئة المناسبة",
      empty: "ستظهر المسارات المنشورة هنا فور اعتمادها.",
      general: "مسار عام",
    },
    audiences: { adult: "الكبار", child: "الأطفال", family: "الأسرة", all: "جميع الأعمار" },
    journey: {
      eyebrow: "بداية واضحة",
      title: "كيف تبدأ رحلتك؟",
      description: "أربع خطوات بسيطة تنقلك من الطلب إلى أول حصة منظمة.",
      steps: [
        ["تقديم الطلب", "أرسل بيانات الطالب واحتياجه من النموذج الآمن."],
        ["تحديد المستوى", "تراجع الأكاديمية نقطة البداية والمسار الأنسب."],
        ["اختيار البرنامج", "تُحدد الخطة والموعد بما يناسب الطالب."],
        ["بدء الحصص", "تبدأ المتابعة مع المعلم من بوابة واحدة واضحة."],
      ],
    },
    why: {
      eyebrow: "تعليم منظم وآمن",
      title: "لماذا نور الوحي؟",
      description: "الأدوات تخدم رحلة التعلم، ولا تستبدل دور المعلم أو التواصل الإنساني.",
      items: [
        ["متابعة المعلم", "ملاحظات معتمدة وخطة تناسب مستوى الطالب."],
        ["تنظيم الحصص", "مواعيد واضحة تظهر بالتوقيت المحلي لكل مستخدم."],
        ["تقارير التقدم", "ملخصات قابلة للفهم دون مقارنة الطلاب ببعضهم."],
        ["تواصل رسمي آمن", "قنوات معتمدة تحفظ الخصوصية وتوضح المسؤولية."],
      ],
    },
    progress: {
      eyebrow: "بوابة الطالب",
      title: "متابعة الحفظ والتقدم بهدوء",
      description:
        "معاينة توضيحية للواجهة التي تجمع الهدف والمراجعة والحضور، دون عرض نصوص الآيات أو بيانات شخصية.",
      preview: "عرض توضيحي بلا بيانات طالب",
      ring: "رحلة الحفظ",
      goals: "أهداف الحفظ",
      review: "المراجعة",
      attendance: "الحضور والالتزام",
      report: "تقرير معتمد",
      action: "اكتشف تجربة الطالب",
    },
    teachers: {
      eyebrow: "فريق التعليم",
      title: "معلمو الأكاديمية",
      description:
        "لا نعرض أي ملف شخصي قبل اعتماده للنشر. وعند النشر ستظهر المؤهلات والتخصص والخبرة المصرّح بها فقط.",
      items: [
        ["مؤهلات موثقة", "مراجعة المؤهلات قبل إتاحة الملف للتعريف العام."],
        ["تخصص مناسب", "ربط المعلم بالمسارات التي أُجيز للعمل عليها."],
        ["خبرة تعليمية", "عرض الخبرة المعتمدة فقط دون بيانات شخصية حساسة."],
      ],
      empty: "لا توجد ملفات معلمين معتمدة للنشر العام حاليًا.",
    },
    experiences: {
      eyebrow: "تجربة يمكن الوثوق بها",
      title: "ما الذي تراه الأسرة داخل النظام؟",
      description:
        "لا ننشر آراء منسوبة لأشخاص دون موافقة. بدلًا من ذلك، هذه أهم أدوات المتابعة المتاحة فعليًا.",
      items: [
        ["موعد واضح", "الحصص القادمة والتغييرات في مكان واحد."],
        ["تقدم مفهوم", "مؤشرات الحفظ والمراجعة وفق السجل المعتمد."],
        ["تقارير قابلة للرجوع", "تقارير دورية وشهادات يمكن التحقق منها."],
      ],
    },
    faq: {
      eyebrow: "إجابات سريعة",
      title: "الأسئلة الشائعة",
      description: "أهم ما تحتاج معرفته قبل تقديم الطلب.",
      items: [
        [
          "كيف أقدّم للطالب؟",
          "افتح نموذج الالتحاق، وأدخل البيانات المطلوبة، ثم تراجع الإدارة الطلب وتتواصل عبر القنوات الرسمية.",
        ],
        [
          "كيف يُحدد المستوى؟",
          "تحدد الأكاديمية نقطة البداية المناسبة قبل اعتماد المسار والخطة التعليمية.",
        ],
        [
          "كيف تُنظم الحصص؟",
          "تظهر المواعيد في بوابة الطالب بالتوقيت المحلي مع أدوات التقويم المعتمدة.",
        ],
        [
          "كيف يتابع ولي الأمر؟",
          "تتيح بوابة ولي الأمر الاطلاع على البيانات المصرح بها للطلاب المرتبطين بحسابه.",
        ],
        [
          "كيف تظهر الأسعار؟",
          "اختر الدولة في قسم الباقات لعرض العملة والسعر الساري المسجل في النظام.",
        ],
        [
          "كيف أحصل على شهادة؟",
          "تظهر الشهادات في البوابة بعد إصدارها واعتمادها، ويمكن تنزيلها والتحقق منها.",
        ],
      ],
    },
    closing: {
      title: "ابدأ رحلتك مع القرآن الكريم",
      description: "قدّم طلب الالتحاق الآن، وسنتواصل معك لتحديد المسار والخطوة التالية.",
      action: "تقديم طلب الالتحاق",
    },
  },
  en: {
    tracks: {
      eyebrow: "Learning tracks",
      title: "Tracks that start at the student’s level",
      description:
        "We identify the right starting point, then shape a clear plan with the teacher and family.",
      action: "View track details",
      level: "Suitable for",
      empty: "Published tracks will appear here once approved.",
      general: "General track",
    },
    audiences: { adult: "Adults", child: "Children", family: "Families", all: "All ages" },
    journey: {
      eyebrow: "A clear beginning",
      title: "How does your journey start?",
      description: "Four simple steps take you from application to a structured first lesson.",
      steps: [
        ["Submit the application", "Share the student’s needs through the secure form."],
        ["Assess the level", "The academy reviews the right starting point and track."],
        ["Choose the programme", "The plan and time are agreed around the student."],
        ["Start lessons", "Follow the teacher and progress from one clear portal."],
      ],
    },
    why: {
      eyebrow: "Organised and safe learning",
      title: "Why Noor Al-Wahy?",
      description:
        "The tools support the learning journey without replacing the teacher or human communication.",
      items: [
        ["Teacher follow-up", "Approved notes and a plan suited to the student’s level."],
        ["Organised lessons", "Clear times displayed in each user’s local timezone."],
        ["Progress reports", "Readable summaries without comparing students."],
        [
          "Safe official contact",
          "Approved channels that protect privacy and clarify responsibility.",
        ],
      ],
    },
    progress: {
      eyebrow: "Student portal",
      title: "Calm, clear memorisation follow-up",
      description:
        "An illustrative preview combining goals, review and attendance without verse text or personal data.",
      preview: "Illustrative preview — no student data",
      ring: "Memorisation journey",
      goals: "Memorisation goals",
      review: "Review",
      attendance: "Attendance and consistency",
      report: "Approved report",
      action: "Explore the student experience",
    },
    teachers: {
      eyebrow: "Teaching team",
      title: "Academy teachers",
      description:
        "No personal profile is shown before publication approval. Only approved qualifications, specialisms and experience are displayed.",
      items: [
        [
          "Verified qualifications",
          "Qualifications are reviewed before a profile can be published.",
        ],
        ["Relevant specialism", "Teachers are linked only to tracks they are approved to teach."],
        [
          "Teaching experience",
          "Only approved experience is shown, never sensitive personal data.",
        ],
      ],
      empty: "No teacher profiles are currently approved for public display.",
    },
    experiences: {
      eyebrow: "A trustworthy experience",
      title: "What does the family see in the system?",
      description:
        "We do not publish attributed testimonials without consent. These are the real follow-up tools currently available.",
      items: [
        ["A clear schedule", "Upcoming lessons and changes in one place."],
        ["Readable progress", "Memorisation and review indicators based on approved records."],
        ["Records to revisit", "Periodic reports and verifiable certificates."],
      ],
    },
    faq: {
      eyebrow: "Quick answers",
      title: "Frequently asked questions",
      description: "The essentials to know before applying.",
      items: [
        [
          "How do I apply?",
          "Open the application form, enter the required details, and the academy will review it and contact you through official channels.",
        ],
        [
          "How is the level assessed?",
          "The academy identifies the right starting point before confirming the track and learning plan.",
        ],
        [
          "How are lessons organised?",
          "Times appear in the student portal in the local timezone, alongside approved calendar tools.",
        ],
        [
          "How can a parent follow progress?",
          "The parent portal shows authorised information for students linked to the parent’s account.",
        ],
        [
          "How are prices displayed?",
          "Choose a country in the packages section to see the active system price and currency.",
        ],
        [
          "How do certificates work?",
          "Certificates appear after issue and approval, ready to download and verify.",
        ],
      ],
    },
    closing: {
      title: "Begin your journey with the Quran",
      description: "Apply now and we will contact you to confirm the right track and next step.",
      action: "Submit an application",
    },
  },
} as const;

const stepIcons = [ClipboardCheck, UserCheck, Route, MonitorCheck] as const;
const whyIcons = [HeartHandshake, CalendarCheck2, FileChartColumnIncreasing, ShieldCheck] as const;
const teacherIcons = [GraduationCap, BookOpenCheck, Award] as const;
const experienceIcons = [CalendarCheck2, BarChart3, FileChartColumnIncreasing] as const;

export async function PublicHomeContent({ locale }: { locale: AppLocale }) {
  const t = copy[locale];
  const tracks = await getPublishedTracks();

  return (
    <>
      <section
        id="tracks"
        data-testid="public-tracks-section"
        className="scroll-mt-28 px-4 pt-10 pb-16 sm:px-6 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-[88rem]">
          <SectionHeading
            eyebrow={t.tracks.eyebrow}
            title={t.tracks.title}
            description={t.tracks.description}
          />
          {tracks.length ? (
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {tracks.slice(0, 6).map((item, index) => {
                const name =
                  locale === "en" && item.nameEn ? item.nameEn : item.nameAr || t.tracks.general;
                return (
                  <article
                    key={item.id}
                    className="group relative overflow-hidden rounded-[1.25rem] border border-[#c7a45a]/25 bg-card p-7 shadow-card"
                  >
                    <span className="grid size-12 place-items-center rounded-full bg-[#f6ead2] text-[#8a5b12] dark:bg-accent">
                      <BookOpenCheck className="size-6" aria-hidden="true" />
                    </span>
                    <span
                      className="absolute end-6 top-5 font-quran text-4xl text-secondary/30"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <h3 className="mt-6 text-xl font-black text-primary">{name}</h3>
                    <p className="mt-3 line-clamp-3 leading-7 text-muted-foreground">
                      {(locale === "en" && item.descriptionEn
                        ? item.descriptionEn
                        : item.descriptionAr) || t.tracks.description}
                    </p>
                    <p className="mt-5 text-sm font-bold text-primary">
                      <span className="text-muted-foreground">{t.tracks.level}: </span>
                      {audienceLabel(item.audience, t.audiences)}
                    </p>
                    <Button
                      asChild
                      variant="ghost"
                      className="mt-5 px-0 text-[#7d500d] dark:text-secondary"
                    >
                      <Link href="/tracks">{t.tracks.action}</Link>
                    </Button>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={BookOpenCheck} text={t.tracks.empty} />
          )}
        </div>
      </section>

      <section className="border-y border-secondary/15 bg-[#f8f2e7] px-4 py-20 sm:px-6 lg:py-24 dark:bg-card/45">
        <div className="mx-auto max-w-[88rem]">
          <SectionHeading
            eyebrow={t.journey.eyebrow}
            title={t.journey.title}
            description={t.journey.description}
            centered
          />
          <ol className="relative mt-12 grid gap-5 lg:grid-cols-4">
            {t.journey.steps.map(([title, description], index) => {
              const Icon = stepIcons[index]!;
              return (
                <li
                  key={title}
                  className="relative rounded-[1.25rem] border border-secondary/20 bg-card p-6 text-center shadow-card"
                >
                  <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary text-secondary shadow-card">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <span className="mt-4 block text-xs font-black text-[#8a5b12]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-lg font-black text-primary">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section id="why" className="scroll-mt-28 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-[88rem] gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <SectionHeading
            eyebrow={t.why.eyebrow}
            title={t.why.title}
            description={t.why.description}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {t.why.items.map(([title, description], index) => {
              const Icon = whyIcons[index]!;
              return (
                <FeatureCard
                  key={title}
                  icon={Icon}
                  title={title}
                  description={description}
                  tone={index}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-y border-secondary/15 bg-primary px-4 py-20 text-primary-foreground sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-[88rem] gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm font-black text-secondary">{t.progress.eyebrow}</p>
            <h2 className="mt-3 text-3xl leading-tight font-black text-balance sm:text-5xl">
              {t.progress.title}
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-9 text-primary-foreground/75">
              {t.progress.description}
            </p>
            <Button asChild variant="gold" size="lg" className="mt-7">
              <Link href="/auth/login">{t.progress.action}</Link>
            </Button>
          </div>
          <div className="rounded-[1.5rem] border border-white/15 bg-[#fffdf8] p-5 text-foreground shadow-soft sm:p-7 dark:bg-[#102744]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-black text-primary">{t.progress.ring}</h3>
              <span className="rounded-full bg-[#f6ead2] px-3 py-1 text-xs font-bold text-[#714307] dark:bg-accent dark:text-secondary">
                {t.progress.preview}
              </span>
            </div>
            <div className="mt-6 grid gap-7 sm:grid-cols-[10rem_1fr] sm:items-center">
              <div
                className="relative mx-auto grid size-36 place-items-center rounded-full bg-[conic-gradient(#c7a45a_0_63%,#efe4cf_63%_100%)] p-3"
                aria-hidden="true"
              >
                <div className="grid size-full place-items-center rounded-full bg-card">
                  <BookOpenCheck className="size-9 text-secondary" />
                </div>
              </div>
              <div className="grid gap-5">
                <PreviewBar label={t.progress.goals} width="72%" />
                <PreviewBar label={t.progress.review} width="54%" />
                <PreviewBar label={t.progress.attendance} width="86%" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-secondary/20 bg-[#fbf6eb] p-4 dark:bg-accent/25">
              <FileChartColumnIncreasing className="size-5 text-secondary" aria-hidden="true" />
              <span className="font-bold text-primary">{t.progress.report}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="teachers" className="scroll-mt-28 px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-[88rem]">
          <SectionHeading
            eyebrow={t.teachers.eyebrow}
            title={t.teachers.title}
            description={t.teachers.description}
            centered
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {t.teachers.items.map(([title, description], index) => {
              const Icon = teacherIcons[index]!;
              return (
                <FeatureCard
                  key={title}
                  icon={Icon}
                  title={title}
                  description={description}
                  tone={index + 1}
                  centered
                />
              );
            })}
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-secondary/35 bg-[#fffaf0] p-5 text-center text-sm font-bold text-muted-foreground dark:bg-accent/20">
            {t.teachers.empty}
          </div>
        </div>
      </section>

      <Suspense
        fallback={
          <section id="packages" className="border-y border-secondary/15 bg-muted/35 px-4 py-20">
            <div className="mx-auto h-72 max-w-[88rem] animate-pulse rounded-[1.25rem] bg-card shadow-card" />
          </section>
        }
      >
        <HomePackages locale={locale} />
      </Suspense>

      <section className="px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-[88rem] rounded-[2rem] border border-secondary/20 bg-[#f8f2e7] p-6 shadow-card sm:p-10 dark:bg-card/55">
          <SectionHeading
            eyebrow={t.experiences.eyebrow}
            title={t.experiences.title}
            description={t.experiences.description}
            centered
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {t.experiences.items.map(([title, description], index) => {
              const Icon = experienceIcons[index]!;
              return (
                <FeatureCard
                  key={title}
                  icon={Icon}
                  title={title}
                  description={description}
                  tone={index + 2}
                  centered
                />
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="scroll-mt-28 border-y border-secondary/15 bg-card/55 px-4 py-20 sm:px-6 lg:py-24"
      >
        <div className="mx-auto grid max-w-[78rem] gap-10 lg:grid-cols-[0.65fr_1.35fr]">
          <SectionHeading
            eyebrow={t.faq.eyebrow}
            title={t.faq.title}
            description={t.faq.description}
          />
          <div className="grid content-start gap-3">
            {t.faq.items.map(([question, answer]) => (
              <details
                key={question}
                className="group rounded-2xl border border-secondary/20 bg-card p-1 shadow-card"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 font-black text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  {question}
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary/12 text-secondary transition-transform group-open:rotate-45 motion-reduce:transition-none"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="px-4 pt-1 pb-5 leading-8 text-muted-foreground">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto flex max-w-[88rem] flex-col items-start justify-between gap-7 overflow-hidden rounded-[2rem] bg-primary p-8 text-primary-foreground shadow-soft sm:p-12 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <Sparkles className="size-7 text-secondary" aria-hidden="true" />
            <h2 className="mt-4 text-3xl font-black text-balance sm:text-4xl">{t.closing.title}</h2>
            <p className="mt-3 leading-8 text-primary-foreground/75">{t.closing.description}</p>
          </div>
          <Button asChild variant="gold" size="lg">
            <Link href="/apply">{t.closing.action}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  centered = false,
  description,
  eyebrow,
  title,
}: {
  centered?: boolean;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <header className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-sm font-black text-[#8a5b12] dark:text-secondary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl leading-tight font-black text-balance text-primary sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-8 text-muted-foreground sm:text-lg">{description}</p>
    </header>
  );
}

function FeatureCard({
  centered = false,
  description,
  icon: Icon,
  title,
  tone,
}: {
  centered?: boolean;
  description: string;
  icon: typeof UsersRound;
  title: string;
  tone: number;
}) {
  const tones = [
    "bg-[#eef5ff] text-[#245fa8]",
    "bg-[#eff8f2] text-[#237a4b]",
    "bg-[#fff7e7] text-[#8a5b12]",
    "bg-[#f4f1ff] text-[#5d55b4]",
  ];
  return (
    <article
      className={`rounded-[1.25rem] border border-secondary/20 bg-card p-6 shadow-card ${centered ? "text-center" : ""}`}
    >
      <span
        className={`grid size-12 place-items-center rounded-full ${centered ? "mx-auto" : ""} ${tones[tone % tones.length]} dark:bg-accent dark:text-secondary`}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-lg font-black text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
    </article>
  );
}

function PreviewBar({ label, width }: { label: string; width: string }) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-primary">{label}</p>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#efe4cf] dark:bg-muted">
        <div
          className="h-full rounded-full bg-linear-to-r from-[#a97019] to-[#d7b768]"
          style={{ width }}
        />
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof UsersRound; text: string }) {
  return (
    <div className="mt-10 rounded-[1.25rem] border border-dashed border-secondary/35 bg-card p-10 text-center shadow-card">
      <Icon className="mx-auto size-9 text-secondary" aria-hidden="true" />
      <p className="mt-4 text-muted-foreground">{text}</p>
    </div>
  );
}

function audienceLabel(
  audience: string | null,
  labels: { adult: string; child: string; family: string; all: string },
) {
  if (audience === "adult") return labels.adult;
  if (audience === "child") return labels.child;
  if (audience === "family") return labels.family;
  return labels.all;
}
