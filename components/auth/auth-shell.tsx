import { Suspense } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

type AuthShellProps = {
  brand: string;
  children: React.ReactNode;
  description: string;
  eyebrow: string;
  principle: string;
  theme: {
    enableDark: string;
    enableLight: string;
  };
  title: string;
};

export function AuthShell({
  brand,
  children,
  description,
  eyebrow,
  principle,
  theme,
  title,
}: AuthShellProps) {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary via-secondary to-primary"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute start-[8%] -top-36 size-80 rotate-45 rounded-[4.5rem] border border-secondary/20 bg-secondary/5"
        aria-hidden="true"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
        <BrandMark label={brand} />
        <div className="flex items-center gap-2">
          <ThemeToggle
            compact
            enableDarkLabel={theme.enableDark}
            enableLightLabel={theme.enableLight}
          />
          <Suspense fallback={<span className="block size-11 rounded-full border bg-card" />}>
            <LocaleSwitcher />
          </Suspense>
        </div>
      </header>

      <main
        id="main-content"
        className="relative z-10 mx-auto grid min-h-[calc(100svh-5.5rem)] w-full max-w-6xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,0.72fr)] lg:px-8 lg:py-14"
      >
        <section className="max-w-xl text-center lg:text-start">
          <p className="text-sm font-extrabold text-secondary">{eyebrow}</p>
          <h1 className="mt-4 text-3xl leading-tight font-black tracking-tight text-balance text-primary sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-[42rem] text-base leading-8 text-muted-foreground lg:mx-0 lg:text-lg">
            {description}
          </p>
          <div className="mx-auto mt-8 flex max-w-md items-center gap-4 rounded-[2rem] border border-secondary/25 bg-card/72 p-4 text-start shadow-soft backdrop-blur lg:mx-0">
            <span
              className="grid size-12 shrink-0 rotate-45 place-items-center rounded-xl border border-secondary/45 bg-primary text-secondary"
              aria-hidden="true"
            >
              <span className="size-2 -rotate-45 rounded-full bg-secondary" />
            </span>
            <p className="text-sm leading-7 font-semibold text-foreground">{principle}</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-[2rem] border border-secondary/30 bg-card/96 p-6 shadow-[0_1.5rem_5rem_-2.5rem_rgb(15_37_71_/_0.45)] sm:p-8">
          {children}
        </section>
      </main>
    </div>
  );
}
