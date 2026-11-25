"use client";

import { Check, ChevronDown, UsersRound } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type ChildOption = { id: string; name: string };

export function ParentChildSwitcher({
  options,
  compact = false,
  locale,
}: {
  options: ChildOption[];
  compact?: boolean;
  locale: "ar" | "en";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!options.length) return null;

  const requested = searchParams.get("student");
  const selected = options.find((child) => child.id === requested) ?? options[0]!;
  const query = Object.fromEntries(searchParams.entries());

  return (
    <details className="group/child relative shrink-0">
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-secondary/25 bg-card px-3 font-bold text-primary shadow-sm outline-none hover:bg-accent/35 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
          compact ? "max-w-52 text-sm" : "min-w-52",
        )}
      >
        <UsersRound className="size-4 shrink-0 text-secondary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          <span className="sr-only">
            {locale === "ar" ? "الابن المختار: " : "Selected child: "}
          </span>
          {selected.name}
        </span>
        <ChevronDown
          className="size-4 shrink-0 transition-transform group-open/child:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="absolute end-0 top-full z-50 mt-2 grid min-w-64 gap-1 rounded-2xl border border-secondary/20 bg-card p-2 shadow-xl">
        <p className="px-3 py-2 text-xs font-bold text-muted-foreground">
          {locale === "ar" ? "تغيير الابن" : "Switch child"}
        </p>
        {options.map((child) => {
          const active = child.id === selected.id;
          return (
            <Link
              key={child.id}
              href={{ pathname, query: { ...query, student: child.id } }}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold outline-none hover:bg-accent/45 focus-visible:ring-2 focus-visible:ring-ring",
                active && "bg-[#f7ecd4] text-[#8a5b12] dark:bg-accent dark:text-secondary",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{child.name}</span>
              {active ? <Check className="size-4" aria-hidden="true" /> : null}
            </Link>
          );
        })}
      </div>
    </details>
  );
}
