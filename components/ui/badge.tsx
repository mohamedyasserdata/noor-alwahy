import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-7 w-fit items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold leading-none",
  {
    variants: {
      variant: {
        default: "border-primary/10 bg-primary text-primary-foreground",
        secondary: "border-secondary/30 bg-secondary/18 text-primary",
        success: "border-success/25 bg-success/10 text-[#245f45] dark:text-success",
        warning: "border-warning/30 bg-warning/12 text-warning",
        destructive: "border-destructive/25 bg-destructive/10 text-destructive",
        outline: "bg-card text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  };

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Component = asChild ? Slot : "span";
  return (
    <Component data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
