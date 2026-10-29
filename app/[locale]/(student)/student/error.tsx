"use client";

import { PortalErrorState } from "@/components/portal/portal-error-state";

export default function StudentError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <PortalErrorState portal="student" retry={retry} digest={error.digest} />;
}
