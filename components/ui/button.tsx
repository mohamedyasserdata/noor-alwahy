import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition-[color,background-color,border-color,box-shadow,transform] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px motion-reduce:transform-none motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-card hover:bg-primary/92",
        gold: "bg-secondary text-secondary-foreground shadow-card hover:bg-secondary/86",
        outline: "border bg-card text-foreground hover:border-secondary hover:bg-accent/50",
        ghost: "text-foreground hover:bg-accent/55",
        destructive:
          "bg-destructive text-white shadow-card hover:bg-destructive/90 dark:bg-[#9f3434] dark:hover:bg-[#8f2e2e]",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 min-h-9 rounded-md px-3 text-xs",
        lg: "h-12 min-h-12 rounded-xl px-6 text-base",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
