"use client";

import { PortalErrorState } from "@/components/portal/portal-error-state";

export default function ParentError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <PortalErrorState portal="parent" retry={retry} digest={error.digest} />;
}
