import { ChevronDown, Clock3, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/routing";
import { signOutAction } from "@/lib/auth/actions";
import type { UserRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

type AccountMenuProps = {
  account: {
    email: string;
    fullName: string;
    role: UserRole;
    timezone: string;
  };
  compact?: boolean;
  labels: {
    accountSettings: string;
    closeHint: string;
    email: string;
    role: string;
    roles: Record<UserRole, string>;
    signOut: string;
    timezone: string;
  };
  locale: AppLocale;
};

export function AccountMenu({ account, compact = false, labels, locale }: AccountMenuProps) {
  return (
    <details
      className={cn("group relative", compact ? "size-11 shrink-0" : "w-full")}
      data-testid="account-menu"
    >
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer touch-manipulation list-none items-center rounded-lg border bg-card text-foreground shadow-card transition-[border-color,background-color] marker:hidden hover:border-secondary hover:bg-accent/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden",
          compact ? "size-11 justify-center rounded-full" : "w-full gap-3 px-3 py-2 text-start",
        )}
        aria-label={labels.accountSettings}
        title={compact ? labels.accountSettings : undefined}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-secondary">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        {!compact ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black">{account.fullName}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {labels.roles[account.role]}
            </span>
          </span>
        ) : null}
        {!compact ? (
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        ) : null}
      </summary>

      <section
        className={cn(
          "z-50 overflow-hidden rounded-2xl border bg-card shadow-[0_1rem_3rem_-1rem_rgb(15_37_71_/_0.38)]",
          compact
            ? "fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.5rem)] w-auto"
            : "absolute inset-x-0 bottom-[calc(100%+0.5rem)] w-[min(22rem,calc(100vw-1.5rem))]",
        )}
        aria-label={labels.accountSettings}
      >
        <header className="border-b border-secondary/20 bg-accent/25 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-secondary">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-black text-primary">{account.fullName}</h2>
              <p className="truncate text-xs text-muted-foreground">{account.email}</p>
            </div>
          </div>
        </header>

        <dl className="grid gap-3 px-4 py-4 text-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{labels.role}</dt>
              <dd className="font-bold text-primary">{labels.roles[account.role]}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{labels.email}</dt>
              <dd className="font-bold break-all text-primary" dir="ltr">
                {account.email}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{labels.timezone}</dt>
              <dd className="font-bold text-primary" dir="ltr">
                {account.timezone}
              </dd>
            </div>
          </div>
        </dl>

        <form action={signOutAction.bind(null, locale)} className="border-t p-3">
          <Button type="submit" variant="outline" className="w-full justify-start text-destructive">
            <LogOut aria-hidden="true" />
            {labels.signOut}
          </Button>
        </form>
        <p className="sr-only">{labels.closeHint}</p>
      </section>
    </details>
  );
}
