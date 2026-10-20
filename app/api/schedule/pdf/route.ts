import { z } from "zod";

import { getSchedulePdf } from "@/lib/schedules/pdf";

const localeSchema = z.enum(["ar", "en"]);

export const maxDuration = 60;

export async function GET(request: Request) {
  const locale = localeSchema.catch("ar").parse(new URL(request.url).searchParams.get("locale"));
  const result = await getSchedulePdf(locale);
  if (result.kind === "unauthorized") return new Response(null, { status: 401 });
  return new Response(Buffer.from(result.pdf), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": 'attachment; filename="noor-alwahy-schedule.pdf"',
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
