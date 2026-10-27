import { ParentChildProfile } from "@/components/parent/parent-child-profile";
import type { AppLocale } from "@/i18n/routing";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function ParentChildrenSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Search;
}) {
  return <ParentChildProfile locale={locale} searchParams={searchParams} />;
}
