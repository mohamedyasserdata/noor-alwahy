import { cn } from "@/lib/utils";

type BrandMarkProps = {
  label: string;
  className?: string;
};

export function BrandMark({ label, className }: BrandMarkProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <span className="relative grid size-11 place-items-center rounded-xl bg-primary text-secondary shadow-card">
        <svg viewBox="0 0 48 48" className="size-7" aria-hidden="true">
          <path
            d="M24 4 29.2 14.8 41 16.5 32.5 25 34.5 37 24 31.4 13.5 37 15.5 25 7 16.5 18.8 14.8 24 4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M17 22.5c4.5 0 7 1.5 7 4.8 0-3.3 2.5-4.8 7-4.8v8c-3.3 0-5.5.8-7 2.5-1.5-1.7-3.7-2.5-7-2.5v-8Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="text-lg font-black tracking-tight text-primary">{label}</span>
    </div>
  );
}
