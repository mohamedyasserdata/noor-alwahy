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
  compact?: boolean;
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
  compact = false,
}: StudentPageShellProps) {
  return (
    <div className="student-home min-h-svh pb-10 sm:pb-14" data-testid="student-page-shell">
      <div
        className={cn(
          "relative overflow-hidden",
          compact
            ? "border-b border-secondary/15 bg-card"
            : "min-h-[12.5rem] bg-[url('/images/student/golden-quran-sunlit-mosque.png')] bg-cover bg-[position:34%_58%] sm:min-h-[15rem] lg:min-h-[17rem] lg:bg-[position:center_58%]",
        )}
        aria-labelledby={titleId}
        data-testid="student-page-hero"
      >
        {!compact ? (
          <div
            className="absolute inset-0 bg-linear-to-b from-[#fffaf0]/45 via-[#fffaf0]/82 to-[#fffaf0] lg:bg-linear-to-r lg:from-[#fffaf0]/18 lg:via-[#fffaf0]/55 lg:to-[#fffaf0]/98 dark:from-[#091a33]/55 dark:via-[#091a33]/88 dark:to-[#091a33] lg:dark:from-[#091a33]/24 lg:dark:via-[#091a33]/72 lg:dark:to-[#091a33]/98"
            aria-hidden="true"
          />
        ) : null}
        <div
          className={cn(
            "relative mx-auto w-full max-w-[100rem] px-5",
            compact
              ? "py-6 sm:px-8 sm:py-8 lg:px-12"
              : "grid min-h-[12.5rem] items-end pt-7 pb-12 sm:min-h-[15rem] sm:px-8 sm:pb-16 lg:min-h-[17rem] lg:grid-cols-2 lg:items-center lg:px-12 lg:py-8",
          )}
          dir={compact ? (locale === "ar" ? "rtl" : "ltr") : "ltr"}
        >
          {!compact ? <span aria-hidden="true" /> : null}
          <header
            className={cn(
              "max-w-2xl",
              compact
                ? ""
                : "rounded-2xl bg-[#fffaf0]/82 p-4 backdrop-blur-[2px] sm:p-5 lg:bg-transparent lg:p-0 lg:backdrop-blur-none dark:bg-[#091a33]/82 lg:dark:bg-transparent",
            )}
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <p className="flex items-center gap-2 text-sm font-black text-[#9a6512] sm:text-base dark:text-secondary">
              <Icon className="size-5" aria-hidden="true" />
              {eyebrow}
            </p>
            <h1
              id={titleId}
              className={cn(
                "mt-1.5 leading-tight font-black text-balance text-[#0b2b57] dark:text-primary",
                compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl lg:text-5xl",
              )}
            >
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5d6f86] sm:text-base sm:leading-7 dark:text-muted-foreground">
              {description}
            </p>
          </header>
        </div>
      </div>

      <div
        className={cn(
          "student-page-content relative z-10 mx-auto w-full max-w-[100rem] px-4 sm:px-6 lg:px-10",
          compact ? "pt-5 sm:pt-6" : "-mt-7 sm:-mt-10",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
