import type { LucideIcon } from "lucide-react";

import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type StudentPageShellProps = {
  children: React.ReactNode;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  locale: AppLocale;
  title: string;
  titleId: string;
  contentClassName?: string;
};

export function StudentPageShell({
  children,
  contentClassName,
  description,
  eyebrow,
  icon: Icon,
  locale,
  title,
  titleId,
}: StudentPageShellProps) {
  return (
    <div className="student-home min-h-svh pb-12 sm:pb-16" data-testid="student-page-shell">
      <div
        className="relative min-h-[20rem] overflow-hidden bg-[url('/images/student/golden-quran-sunlit-mosque.png')] bg-cover bg-[position:38%_58%] sm:min-h-[21rem] lg:bg-[position:center_58%]"
        aria-labelledby={titleId}
        data-testid="student-page-hero"
      >
        <div
          className="absolute inset-0 bg-linear-to-b from-[#fffaf0]/10 via-[#fffaf0]/58 to-[#fffaf0] lg:bg-linear-to-r lg:from-transparent lg:via-[#fffaf0]/38 lg:to-[#fffaf0]/96 dark:from-[#091a33]/30 dark:via-[#091a33]/78 dark:to-[#091a33] lg:dark:from-[#091a33]/18 lg:dark:via-[#091a33]/68 lg:dark:to-[#091a33]/96"
          aria-hidden="true"
        />
        <div
          className="relative mx-auto grid min-h-[20rem] w-full max-w-[100rem] items-end px-5 pt-14 pb-20 sm:min-h-[21rem] sm:px-8 lg:grid-cols-2 lg:items-center lg:px-12 lg:py-10"
          dir="ltr"
        >
          <span aria-hidden="true" />
          <header
            className="max-w-2xl rounded-3xl bg-[#fffaf0]/76 p-5 backdrop-blur-[2px] sm:p-7 lg:bg-transparent lg:p-0 lg:backdrop-blur-none dark:bg-[#091a33]/76 lg:dark:bg-transparent"
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <p className="flex items-center gap-2 text-sm font-black text-[#9a6512] sm:text-base dark:text-secondary">
              <Icon className="size-5" aria-hidden="true" />
              {eyebrow}
            </p>
            <h1
              id={titleId}
              className="mt-2 text-4xl leading-tight font-black text-balance text-[#0b2b57] sm:text-5xl dark:text-primary"
            >
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-8 text-[#5d6f86] sm:text-lg dark:text-muted-foreground">
              {description}
            </p>
          </header>
        </div>
      </div>

      <div
        className={cn(
          "student-page-content relative z-10 mx-auto -mt-14 w-full max-w-[100rem] px-4 sm:px-6 lg:px-10",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
