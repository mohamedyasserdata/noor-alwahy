"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";

const zones = ["UTC", ...Intl.supportedValuesOf("timeZone")];

export function TimezoneField({
  id,
  name = "timezone",
  label,
  initialValue,
  locale,
}: {
  id: string;
  name?: string;
  label: string;
  initialValue: string;
  locale: AppLocale;
}) {
  const listId = useId();
  const [value, setValue] = useState(initialValue);
  const valid = zones.includes(value);
  const preview = valid
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
        timeZone: value,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date())
    : null;
  const invalid =
    locale === "ar"
      ? "اختر منطقة زمنية صحيحة من القائمة."
      : "Choose a valid time zone from the list.";

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        value={value}
        list={listId}
        dir="ltr"
        required
        aria-invalid={!valid}
        aria-describedby={`${id}-preview`}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          event.target.setCustomValidity(zones.includes(next) ? "" : invalid);
        }}
        onInvalid={(event) => event.currentTarget.setCustomValidity(invalid)}
      />
      <datalist id={listId}>
        {zones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
      <p
        id={`${id}-preview`}
        className={`text-xs ${valid ? "text-muted-foreground" : "text-destructive"}`}
        suppressHydrationWarning
      >
        {preview
          ? locale === "ar"
            ? `الوقت الآن: ${preview}`
            : `Current time: ${preview}`
          : invalid}
      </p>
    </div>
  );
}
