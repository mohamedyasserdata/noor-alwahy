import { getAuthenticatedCalendarData } from "@/lib/calendar/feed";
import { renderSchedulePdf } from "@/lib/calendar/pdf";

export async function GET() {
  const result = await getAuthenticatedCalendarData();
  if (result.kind === "unauthorized") return new Response(null, { status: 401 });
  if (result.kind === "not_found") return new Response(null, { status: 404 });

  try {
    const pdf = await renderSchedulePdf(result.document);
    const body = Uint8Array.from(pdf).buffer;
    return new Response(body, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": 'attachment; filename="noor-alwahy-schedule.pdf"',
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "calendar_pdf_generation_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return Response.json({ error: "pdf_generation_failed" }, { status: 503 });
  }
}
