"use client";

import { useState, useTransition } from "react";
import { Ban, CalendarPlus, Check, Copy, Download, LoaderCircle } from "lucide-react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  revokeCalendarFeedTokenAction,
  rotateCalendarFeedTokenAction,
} from "@/lib/calendar/actions";

type Labels = {
  title: string;
  description: string;
  download: string;
  downloadPdf: string;
  generate: string;
  generating: string;
  copy: string;
  copied: string;
  revoke: string;
  revoking: string;
  generated: string;
  revoked: string;
  error: string;
  privacy: string;
  urlLabel: string;
  openTools?: string;
  closeTools?: string;
  confirmGenerate?: string;
  confirmRevoke?: string;
  confirm?: string;
  cancel?: string;
};

export function CalendarExports({ labels }: { labels: Labels }) {
  const [subscriptionUrl, setSubscriptionUrl] = useState("");
  const [notice, setNotice] = useState<"generated" | "revoked" | "error" | "copied" | null>(null);
  const [pendingAction, setPendingAction] = useState<"generate" | "revoke" | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<"generate" | "revoke" | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  function generate() {
    setPendingConfirmation(null);
    setPendingAction("generate");
    startTransition(async () => {
      try {
        const result = await rotateCalendarFeedTokenAction({});
        if (!result.ok) {
          setNotice("error");
        } else {
          setSubscriptionUrl(`${window.location.origin}${result.data.path}`);
          setNotice("generated");
        }
      } catch {
        setNotice("error");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function revoke() {
    setPendingConfirmation(null);
    setPendingAction("revoke");
    startTransition(async () => {
      try {
        const result = await revokeCalendarFeedTokenAction({});
        if (!result.ok) {
          setNotice("error");
        } else {
          setSubscriptionUrl("");
          setNotice("revoked");
        }
      } catch {
        setNotice("error");
      } finally {
        setPendingAction(null);
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(subscriptionUrl);
      setNotice("copied");
    } catch {
      setNotice("error");
    }
  }

  const noticeText =
    notice === "generated"
      ? labels.generated
      : notice === "revoked"
        ? labels.revoked
        : notice === "copied"
          ? labels.copied
          : labels.error;

  return (
    <details className="group mt-8 rounded-3xl border bg-card shadow-card">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span>
          <h2 id="calendar-export-title" className="block text-lg font-black text-primary">
            {labels.title}
          </h2>
          <span className="mt-1 block text-sm text-muted-foreground">{labels.description}</span>
        </span>
        <span className="shrink-0 text-sm font-bold text-muted-foreground group-open:hidden">
          {labels.openTools ?? labels.title}
        </span>
        <span className="hidden shrink-0 text-sm font-bold text-muted-foreground group-open:inline">
          {labels.closeTools ?? labels.title}
        </span>
      </summary>
      <div className="border-t px-5 py-5">
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="gold">
            <Link href="/api/calendar/download" prefetch={false} download>
              <Download aria-hidden="true" /> {labels.download}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/api/calendar/pdf" prefetch={false} download>
              <Download aria-hidden="true" /> {labels.downloadPdf}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPendingConfirmation("generate")}
            disabled={isPending}
          >
            {isPending && pendingAction === "generate" ? (
              <LoaderCircle
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <CalendarPlus aria-hidden="true" />
            )}
            {isPending && pendingAction === "generate" ? labels.generating : labels.generate}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setPendingConfirmation("revoke")}
            disabled={isPending}
          >
            {isPending && pendingAction === "revoke" ? (
              <LoaderCircle
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Ban aria-hidden="true" />
            )}
            {isPending && pendingAction === "revoke" ? labels.revoking : labels.revoke}
          </Button>
        </div>

        {pendingConfirmation ? (
          <div className="mt-5 rounded-2xl border border-secondary/30 bg-secondary/8 p-4">
            <p className="font-black text-primary">
              {pendingConfirmation === "generate"
                ? (labels.confirmGenerate ?? labels.generate)
                : (labels.confirmRevoke ?? labels.revoke)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={pendingConfirmation === "revoke" ? "destructive" : "default"}
                onClick={pendingConfirmation === "generate" ? generate : revoke}
              >
                {labels.confirm ??
                  (pendingConfirmation === "generate" ? labels.generate : labels.revoke)}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPendingConfirmation(null)}>
                {labels.cancel ?? labels.closeTools ?? labels.title}
              </Button>
            </div>
          </div>
        ) : null}

        {subscriptionUrl ? (
          <div className="mt-5 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="grid gap-2 text-sm font-bold" htmlFor="calendar-subscription-url">
              {labels.urlLabel}
              <Input
                id="calendar-subscription-url"
                value={subscriptionUrl}
                readOnly
                dir="ltr"
                className="font-mono text-xs"
              />
            </label>
            <Button type="button" variant="outline" onClick={copy}>
              {notice === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {notice === "copied" ? labels.copied : labels.copy}
            </Button>
          </div>
        ) : null}

        {notice ? (
          <Alert className="mt-4" variant={notice === "error" ? "warning" : "success"}>
            <span aria-live="polite">{noticeText}</span>
          </Alert>
        ) : null}
        <p className="mt-4 text-xs leading-6 text-muted-foreground">{labels.privacy}</p>
      </div>
    </details>
  );
}
