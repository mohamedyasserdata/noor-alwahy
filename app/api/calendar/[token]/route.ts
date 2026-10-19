import { calendarResponse, getSubscriptionCalendar } from "@/lib/calendar/feed";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getSubscriptionCalendar(token);
  if (result.kind === "not_found") return new Response(null, { status: 404 });
  return calendarResponse(result.calendar);
}
