import { calendarResponse, getAuthenticatedCalendar } from "@/lib/calendar/feed";

export async function GET() {
  const result = await getAuthenticatedCalendar();
  if (result.kind === "unauthorized") return new Response(null, { status: 401 });
  if (result.kind === "not_found") return new Response(null, { status: 404 });
  return calendarResponse(result.calendar, "attachment");
}
