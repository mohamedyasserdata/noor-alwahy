"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type AdminSubmitButtonProps = {
  label: string;
  pendingLabel: string;
  variant?: "gold" | "outline" | "destructive";
  confirmation?: SensitiveActionConfirmation;
};

export type SensitiveActionKind =
  | "confirmPayment"
  | "rejectPayment"
  | "recordPayment"
  | "approvePayout"
  | "payPayout"
  | "addExpense"
  | "publishReport"
  | "withdrawReport"
  | "publishAnnouncement"
  | "archiveAnnouncement"
  | "publishTemplate"
  | "archiveTemplate"
  | "disableAccount"
  | "archiveRecord"
  | "publishCertificateTemplate"
  | "revokeCertificate"
  | "lockExamResult"
  | "lockEvaluation";

type ConfirmationDetail = {
  label: "amount" | "currency" | "audience" | "status" | "reason" | "period";
  value?: string;
  fieldName?: string;
};

export type SensitiveActionConfirmation = {
  kind: SensitiveActionKind;
  record: string;
  details?: ConfirmationDetail[];
};

export function AdminSubmitButton({
  label,
  pendingLabel,
  variant = "gold",
  confirmation,
}: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();
  const t = useTranslations("sensitiveActionConfirmation");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const allowSubmit = useRef(false);
  const titleId = useId();
  const [details, setDetails] = useState<
    Array<{ label: ConfirmationDetail["label"]; value: string }>
  >([]);

  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!confirmation || !form) return;

    const intercept = (event: SubmitEvent) => {
      if (allowSubmit.current) return;
      event.preventDefault();
      const formData = new FormData(form);
      setDetails(
        (confirmation.details ?? [])
          .map((detail) => ({
            label: detail.label,
            value:
              detail.value ??
              (detail.fieldName ? String(formData.get(detail.fieldName) ?? "") : ""),
          }))
          .filter((detail) => detail.value.trim()),
      );
      dialogRef.current?.showModal();
    };

    form.addEventListener("submit", intercept);
    return () => form.removeEventListener("submit", intercept);
  }, [confirmation]);

  function confirmSubmission() {
    const form = buttonRef.current?.form;
    if (!form || !buttonRef.current) return;
    allowSubmit.current = true;
    dialogRef.current?.close();
    form.requestSubmit(buttonRef.current);
    allowSubmit.current = false;
  }

  return (
    <>
      <Button ref={buttonRef} type="submit" variant={variant} disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span aria-live="polite">{pendingLabel}</span>
          </>
        ) : (
          label
        )}
      </Button>
      {confirmation ? (
        <dialog
          ref={dialogRef}
          className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-3xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-primary/60"
          aria-labelledby={titleId}
        >
          <div className="border-b p-5 sm:p-6">
            <p className="text-xs font-black tracking-wide text-destructive uppercase">
              {t("eyebrow")}
            </p>
            <h2 id={titleId} className="mt-2 text-xl font-black text-primary">
              {t(`titles.${confirmation.kind}`)}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {t(`consequences.${confirmation.kind}`)}
            </p>
          </div>
          <dl className="grid gap-3 p-5 text-sm sm:p-6">
            <div className="rounded-xl bg-muted/50 p-3">
              <dt className="font-bold text-muted-foreground">{t("record")}</dt>
              <dd className="mt-1 font-black text-primary">{confirmation.record}</dd>
            </div>
            {details.map((detail) => (
              <div key={`${detail.label}-${detail.value}`} className="flex justify-between gap-4">
                <dt className="font-bold text-muted-foreground">{t(`details.${detail.label}`)}</dt>
                <dd className="text-end font-black text-primary">{detail.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col-reverse gap-2 border-t p-5 sm:flex-row sm:justify-end sm:p-6">
            <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()}>
              {t("cancel")}
            </Button>
            <Button type="button" variant={variant} onClick={confirmSubmission}>
              {label}
            </Button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
