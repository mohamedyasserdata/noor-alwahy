"use client";

import { useParams } from "next/navigation";

import { PortalErrorState } from "@/components/portal/portal-error-state";

export default function ParentPortalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ locale: string }>();
  return <PortalErrorState locale={params.locale === "ar" ? "ar" : "en"} reset={reset} />;
}
