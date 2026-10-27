"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function InviteSessionBridge({
  destination,
  errorMessage,
  loadingMessage,
}: {
  destination: string;
  errorMessage: string;
  loadingMessage: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const establishSession = async () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      if (!accessToken || !refreshToken || fragment.get("type") !== "invite") {
        if (active) setFailed(true);
        return;
      }

      const { error } = await createClient().auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        if (active) setFailed(true);
        return;
      }

      window.location.replace(destination);
    };

    void establishSession();
    return () => {
      active = false;
    };
  }, [destination]);

  return (
    <div role={failed ? "alert" : "status"} aria-live={failed ? "assertive" : "polite"}>
      {failed ? (
        <p className="rounded-xl border border-destructive/25 bg-destructive/8 p-4 font-bold text-destructive">
          {errorMessage}
        </p>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border bg-background/65 p-4 font-bold text-primary">
          <LoaderCircle
            className="size-5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span>{loadingMessage}</span>
        </div>
      )}
    </div>
  );
}
