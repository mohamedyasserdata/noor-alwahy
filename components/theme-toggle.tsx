"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

type ThemeToggleProps = {
  enableDarkLabel: string;
  enableLightLabel: string;
  compact?: boolean;
  className?: string;
};

export function ThemeToggle({
  enableDarkLabel,
  enableLightLabel,
  compact = false,
  className,
}: ThemeToggleProps) {
  const isDark = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const accessibleLabel = isDark ? enableLightLabel : enableDarkLabel;

  function toggleTheme() {
    const nextTheme: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";

    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.style.colorScheme = nextTheme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", nextTheme === "dark" ? "#091a33" : "#faf6ec");

    try {
      localStorage.setItem("noor-theme", nextTheme);
    } catch {
      // The theme still works for the current page when storage is unavailable.
    }

    window.dispatchEvent(new Event("noor-theme-change"));
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "default"}
      className={cn(!compact && "w-full justify-start", className)}
      onClick={toggleTheme}
      aria-label={accessibleLabel}
      aria-pressed={isDark}
      title={accessibleLabel}
      data-testid="theme-toggle"
    >
      <Moon className="dark:hidden" aria-hidden="true" />
      <Sun className="hidden dark:block" aria-hidden="true" />
      {!compact && (
        <>
          <span className="dark:hidden">{enableDarkLabel}</span>
          <span className="hidden dark:inline">{enableLightLabel}</span>
        </>
      )}
    </Button>
  );
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("noor-theme-change", onStoreChange);

  return () => window.removeEventListener("noor-theme-change", onStoreChange);
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerThemeSnapshot() {
  return false;
}
