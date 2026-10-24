import Image from "next/image";

import { academyLogoPath } from "@/lib/brand/assets";
import { cn } from "@/lib/utils";
import { isSafeLogoPath } from "@/lib/validators/app-settings";

type BrandMarkProps = {
  label: string;
  className?: string;
  labelClassName?: string;
  logoPath?: string | null;
};

export function BrandMark({ label, className, labelClassName, logoPath }: BrandMarkProps) {
  const safeLogoPath = logoPath && isSafeLogoPath(logoPath) ? logoPath : academyLogoPath;

  return (
    <div className={cn("inline-flex items-center gap-3", className)} translate="no">
      <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-background shadow-card ring-1 ring-secondary/35">
        <Image src={safeLogoPath} alt="" fill sizes="48px" className="object-contain" />
      </span>
      <span className={cn("text-lg font-black tracking-tight text-primary", labelClassName)}>
        {label}
      </span>
    </div>
  );
}
