import { Baby, ChevronLeft, ChevronRight, Eye } from "lucide-react";

import { QuranMap } from "@/components/progress/quran-map";
import { StudentPlanCard } from "@/components/progress/student-plan-card";
import { StudentProgressDashboard } from "@/components/progress/student-progress-dashboard";
import { Alert } from "@/components/ui/alert";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getStudentMemorizationPlan } from "@/lib/memorization-plans/queries";
import { getGuardianChildren } from "@/lib/parent/children";
import { getStudentProgressDashboard } from "@/lib/progress/dashboard";
import { getStudentQuranMap } from "@/lib/progress/quran-map";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function ParentChildrenSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Search;
}) {
  const query = await searchParams;
  const children = await getGuardianChildren();
  const requested = typeof query.student === "string" ? query.student : "";
  const selected = children.find((child) => child.id === requested) ?? children[0];
  const ar = locale === "ar";
  if (!selected)
    return (
      <Alert variant="warning">
        {ar
          ? "لا يوجد أبناء مرتبطون بهذا الحساب. تواصل مع الإدارة للتحقق من الربط."
          : "No children are linked to this account. Contact the academy to verify the link."}
      </Alert>
    );

  const [dashboard, map, plan] = await Promise.all([
    getStudentProgressDashboard(selected.id),
    getStudentQuranMap(selected.id),
    getStudentMemorizationPlan(selected.id),
  ]);
  const DirectionIcon = ar ? ChevronLeft : ChevronRight;
  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="parent-children-title">
      <header className="max-w-3xl">
        <p className="mb-3 flex items-center gap-2 text-sm font-black text-secondary">
          <Eye className="size-4" aria-hidden="true" />
          {ar ? "عرض ولي الأمر · قراءة فقط" : "Guardian view · Read only"}
        </p>
        <h2
          id="parent-children-title"
          className="text-3xl font-black text-balance text-primary sm:text-4xl"
        >
          {ar ? `متابعة ${selected.name}` : `Following ${selected.name}`}
        </h2>
        <p className="mt-4 leading-8 text-muted-foreground">
          {ar
            ? "كل المؤشرات مأخوذة من سجلات الأكاديمية، ولا يمكن تعديلها من بوابة ولي الأمر."
            : "Every indicator comes from academy records and cannot be edited from the guardian portal."}
        </p>
      </header>

      <nav
        aria-label={ar ? "تبديل الأبناء" : "Switch child"}
        className="mt-7 flex gap-2 overflow-x-auto pb-2"
      >
        {children.map((child) => (
          <Link
            key={child.id}
            href={{ pathname: "/parent/children", query: { student: child.id } }}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${child.id === selected.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-primary hover:border-secondary"}`}
            aria-current={child.id === selected.id ? "page" : undefined}
          >
            <Baby className="size-4" aria-hidden="true" />
            {child.name}
            <DirectionIcon className="size-4" aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <StudentProgressDashboard locale={locale} data={dashboard} />
      <StudentPlanCard locale={locale} plan={plan} />
      <div className="mt-8">
        <QuranMap
          locale={locale}
          studentId={map.studentId}
          pages={map.pages}
          surahs={map.surahs}
          initialProgress={map.progress}
        />
      </div>
    </section>
  );
}
