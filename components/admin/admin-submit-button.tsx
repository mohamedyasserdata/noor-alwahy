"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type AdminSubmitButtonProps = {
  label: string;
  pendingLabel: string;
  variant?: "gold" | "outline" | "destructive";
};

export function AdminSubmitButton({
  label,
  pendingLabel,
  variant = "gold",
}: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span aria-live="polite">{pendingLabel}</span>
        </>
      ) : (
        label
      )}
    </Button>
  );
}
