import { CircleAlert, CircleCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

export function AuthNotice({ message, success = false }: { message?: string; success?: boolean }) {
  if (!message) {
    return null;
  }

  const Icon = success ? CircleCheck : CircleAlert;

  return (
    <Alert variant={success ? "success" : "warning"} aria-live="polite">
      <Icon aria-hidden="true" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
