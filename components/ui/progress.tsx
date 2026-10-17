import type * as React from "react";

import { cn } from "@/lib/utils";

type ProgressProps = Omit<React.ComponentProps<"div">, "children"> & {
  value: number;
};

function Progress({ className, value, ...props }: ProgressProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalizedValue}
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full rounded-full bg-secondary transition-[width] motion-reduce:transition-none"
        style={{ width: `${normalizedValue}%` }}
      />
    </div>
  );
}

export { Progress };
