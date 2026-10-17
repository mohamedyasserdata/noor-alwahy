import type { Metadata } from "next";

import { ShowcasePanel } from "@/app/dev/ui/_components/showcase-panel";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

export const metadata: Metadata = {
  title: arMessages.uiShowcase.pageTitle,
  description: arMessages.uiShowcase.pageDescription,
};

export default function UiShowcasePage() {
  return (
    <main className="mx-auto grid w-full max-w-[90rem] gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mx-auto grid max-w-3xl gap-3 text-center">
        <BadgeLabel />
        <h1 className="text-3xl font-black tracking-tight text-primary sm:text-5xl">
          {arMessages.uiShowcase.pageTitle}
        </h1>
        <p className="text-base leading-8 text-muted-foreground sm:text-lg">
          {arMessages.uiShowcase.pageDescription}
        </p>
      </header>

      <ShowcasePanel copy={arMessages.uiShowcase} direction="rtl" language="ar" />

      <div className="flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="size-2 rotate-45 bg-secondary" />
        <span className="h-px flex-1 bg-border" />
      </div>

      <ShowcasePanel copy={enMessages.uiShowcase} direction="ltr" language="en" />
    </main>
  );
}

function BadgeLabel() {
  return (
    <span className="mx-auto inline-flex min-h-8 items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 text-xs font-extrabold text-primary">
      {arMessages.uiShowcase.directionBadge}
    </span>
  );
}
