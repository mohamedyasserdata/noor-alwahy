import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function TeacherPageHeader({
  description,
  eyebrow,
  icon: Icon,
  title,
}: {
  description: string;
  eyebrow: string;
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <header className="teacher-page-header flex min-w-0 items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-black text-secondary sm:text-sm">{eyebrow}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-balance text-primary sm:text-3xl">
          {Icon ? <Icon className="size-7 shrink-0 text-secondary" aria-hidden="true" /> : null}
          <span>{title}</span>
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
    </header>
  );
}

export function TeacherMetricCard({
  detail,
  icon: Icon,
  label,
  tone = "blue",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: "blue" | "gold" | "green" | "violet" | "red";
  value: number | string;
}) {
  return (
    <article className="teacher-metric-card flex min-h-28 min-w-0 items-center gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full [&>svg]:size-5",
          tone === "blue" && "bg-[#dfedff] text-[#2563b8] dark:bg-[#19395f] dark:text-[#8dbcf7]",
          tone === "gold" && "bg-[#fff0d1] text-[#a76600] dark:bg-[#493716] dark:text-[#f0c462]",
          tone === "green" && "bg-[#dff3e7] text-[#16844f] dark:bg-[#173f32] dark:text-[#79d6a6]",
          tone === "violet" && "bg-[#eee4ff] text-[#6d3bc1] dark:bg-[#322650] dark:text-[#c5a8ff]",
          tone === "red" && "bg-[#ffe2e4] text-[#c53646] dark:bg-[#4a252d] dark:text-[#ff9aa6]",
        )}
      >
        <Icon aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-muted-foreground">{label}</p>
        <strong className="mt-0.5 block text-2xl font-black text-primary tabular-nums">
          {value}
        </strong>
        {detail ? <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </article>
  );
}

export function TeacherPanel({
  action,
  children,
  className,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <section
      className={cn("teacher-panel min-w-0 rounded-2xl border bg-card p-4 sm:p-5", className)}
    >
      <header className="mb-4 flex min-w-0 items-center justify-between gap-3 border-b border-secondary/15 pb-3">
        <h2 className="min-w-0 text-lg font-black text-primary sm:text-xl">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
