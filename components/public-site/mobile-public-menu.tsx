"use client";

import {
  BookOpen,
  CircleHelp,
  GraduationCap,
  Home,
  Layers3,
  LogIn,
  Menu,
  Sparkles,
  UsersRound,
  X,
  Headphones,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { BrandMark } from "@/components/brand/brand-mark";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link, usePathname } from "@/i18n/navigation";

const navigation = [
  { href: "/", key: "home", icon: Home },
  { href: "/#tracks", key: "tracks", icon: BookOpen },
  { href: "/#teachers", key: "teachers", icon: GraduationCap },
  { href: "/join-teachers", key: "joinTeachers", icon: UsersRound },
  { href: "/#packages", key: "packages", icon: Layers3 },
  { href: "/#faq", key: "faq", icon: CircleHelp },
  { href: "/contact", key: "contact", icon: Headphones },
] as const;

function LanguageFallback() {
  return <span className="block h-12 w-full rounded-2xl border bg-card" aria-hidden="true" />;
}

export function MobilePublicMenu() {
  const t = useTranslations("publicSite.shell");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className="grid size-11 shrink-0 place-items-center rounded-[0.95rem] border border-secondary/30 bg-[#fffdf8]/88 text-primary shadow-[0_5px_16px_rgba(16,31,59,.08)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-white/5"
        aria-label={t("openMenu")}
        aria-expanded={open}
        aria-controls="mobile-public-menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-6" aria-hidden="true" />
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] sm:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-[#07152b]/58 backdrop-blur-[2px]"
                aria-label={t("closeMenu")}
                onClick={close}
              />
              <div
                id="mobile-public-menu"
                role="dialog"
                aria-modal="true"
                aria-label={t("navigationLabel")}
                className="absolute inset-y-0 start-0 w-[min(88vw,23rem)] overflow-y-auto rounded-e-[2rem] border-e border-secondary/25 bg-[#fffaf0] px-5 py-5 shadow-2xl dark:bg-[#0c1b33]"
              >
                <div className="flex items-center justify-between gap-3 border-b border-secondary/20 pb-5">
                  <BrandMark label={t("brand")} className="min-w-0 [&>span:last-child]:truncate" />
                  <button
                    ref={closeButtonRef}
                    type="button"
                    className="grid size-11 shrink-0 place-items-center rounded-full border border-secondary/30 bg-white/65 text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-white/5"
                    aria-label={t("closeMenu")}
                    onClick={close}
                  >
                    <X className="size-6" aria-hidden="true" />
                  </button>
                </div>

                <nav className="mt-4 grid" aria-label={t("navigationLabel")}>
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const current = item.key === "home" && pathname === "/";
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={close}
                        aria-current={current ? "page" : undefined}
                        className={`flex min-h-14 items-center gap-3 border-b border-secondary/15 px-2 py-2 font-black text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                          current ? "rounded-2xl border-b-0 bg-[#f7e8c9] px-3 text-[#8e5e15]" : ""
                        }`}
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fbf1dc] text-primary dark:bg-white/8 dark:text-secondary">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="flex-1">{t(`navigation.${item.key}`)}</span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="mt-5 grid gap-3">
                  <ThemeToggle
                    enableDarkLabel={t("theme.enableDark")}
                    enableLightLabel={t("theme.enableLight")}
                    className="min-h-12 rounded-2xl transition-none"
                  />
                  <Suspense fallback={<LanguageFallback />}>
                    <LocaleSwitcher strongContrast />
                  </Suspense>
                  <Link
                    href="/apply"
                    onClick={close}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-secondary px-4 font-black text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Sparkles className="size-5" aria-hidden="true" />
                    {t("navigation.apply")}
                  </Link>
                  <Link
                    href="/auth/login"
                    onClick={close}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-black text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <LogIn className="size-5" aria-hidden="true" />
                    {t("login")}
                  </Link>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function AutoClosingDetails({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details
      ref={detailsRef}
      className={className}
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest("a")) detailsRef.current?.removeAttribute("open");
      }}
    >
      {children}
    </details>
  );
}
