"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeLocalAdminMfa } from "@/lib/auth/local-admin-mfa-action";
import { createClient } from "@/lib/supabase/client";

type MfaLabels = {
  code: string;
  error: string;
  enrollAction: string;
  enrollDescription: string;
  enrollPending: string;
  manualCode: string;
  localAction: string;
  localDescription: string;
  localPending: string;
  qrAlt: string;
  recovery: string;
  signOut: string;
  verifyAction: string;
  verifyDescription: string;
  verifyPending: string;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function MfaGate({
  labels,
  localHelperAvailable,
  returnTo,
  unverifiedFactorIds,
  verifiedFactorId,
}: {
  labels: MfaLabels;
  localHelperAvailable: boolean;
  returnTo: string;
  unverifiedFactorIds: string[];
  verifiedFactorId?: string;
}) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<"enroll" | "local" | "signout" | "verify" | null>(null);
  const [supabase] = useState(createClient);
  const factorId = verifiedFactorId ?? enrollment?.factorId;

  async function startEnrollment() {
    setError(false);
    setPending("enroll");

    for (const staleFactorId of unverifiedFactorIds) {
      const { error: cleanupError } = await supabase.auth.mfa.unenroll({
        factorId: staleFactorId,
      });

      if (cleanupError) {
        setError(true);
        setPending(null);
        return;
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Noor Al-Wahy Admin",
    });

    if (enrollError) {
      setError(true);
      setPending(null);
      return;
    }

    setEnrollment({
      factorId: data.id,
      qrCode: encodeQrCode(data.totp.qr_code),
      secret: data.totp.secret,
    });
    setPending(null);
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get("code");

    if (!factorId || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      setError(true);
      return;
    }

    setError(false);
    setPending("verify");
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      code,
      factorId,
    });

    if (verifyError) {
      setError(true);
      setPending(null);
      return;
    }

    window.location.replace(returnTo);
  }

  async function signOut() {
    setPending("signout");
    await supabase.auth.signOut();
    window.location.replace("./login");
  }

  async function completeLocalLogin() {
    setError(false);
    setPending("local");
    const result = await completeLocalAdminMfa();

    if (!result.ok) {
      setError(true);
      setPending(null);
      return;
    }

    window.location.replace(returnTo);
  }

  const showEnrollment = !verifiedFactorId;

  return (
    <div className="grid gap-6">
      {localHelperAvailable ? (
        <div className="grid gap-3 rounded-2xl border border-secondary/50 bg-secondary/10 p-4">
          <p className="text-sm leading-7 text-primary">{labels.localDescription}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-secondary/60 bg-background"
            disabled={pending !== null}
            onClick={completeLocalLogin}
          >
            {pending === "local" ? labels.localPending : labels.localAction}
          </Button>
        </div>
      ) : null}

      {showEnrollment && !enrollment ? (
        <div className="grid gap-4">
          <p className="text-sm leading-7 text-muted-foreground">{labels.enrollDescription}</p>
          <Button
            type="button"
            className="min-h-11"
            disabled={pending !== null}
            onClick={startEnrollment}
          >
            {pending === "enroll" ? labels.enrollPending : labels.enrollAction}
          </Button>
        </div>
      ) : null}

      {enrollment ? (
        <div className="grid justify-items-center gap-4 rounded-2xl border bg-background p-4">
          <Image
            src={enrollment.qrCode}
            alt={labels.qrAlt}
            width={224}
            height={224}
            unoptimized
            className="size-56 rounded-xl bg-white p-2"
          />
          <div className="w-full">
            <p className="text-sm font-bold text-primary">{labels.manualCode}</p>
            <code
              className="mt-2 block rounded-lg border bg-muted p-3 text-center text-sm break-all text-foreground select-all"
              dir="ltr"
            >
              {enrollment.secret}
            </code>
          </div>
        </div>
      ) : null}

      {factorId ? (
        <form className="grid gap-4" onSubmit={verify}>
          <p className="text-sm leading-7 text-muted-foreground">{labels.verifyDescription}</p>
          <div className="grid gap-2">
            <Label htmlFor="mfa-code">{labels.code}</Label>
            <Input
              id="mfa-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              dir="ltr"
              required
            />
          </div>
          <Button type="submit" className="min-h-11" disabled={pending !== null}>
            {pending === "verify" ? labels.verifyPending : labels.verifyAction}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm font-bold text-destructive" role="alert">
          {labels.error}
        </p>
      ) : null}

      <p className="text-xs leading-6 text-muted-foreground">{labels.recovery}</p>
      <button
        type="button"
        onClick={signOut}
        disabled={pending !== null}
        className="min-h-11 touch-manipulation text-sm font-bold text-primary underline decoration-secondary/60 underline-offset-4 outline-none hover:decoration-secondary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {labels.signOut}
      </button>
    </div>
  );
}

function encodeQrCode(value: string) {
  const separator = value.indexOf(",");
  if (separator < 0) return value.trim();

  const prefix = value.slice(0, separator);
  if (prefix.includes(";base64")) return value.trim();
  const payload = value.slice(separator + 1).trim();
  return `${prefix},${encodeURIComponent(payload)}`;
}
