import { z } from "zod";

import { requireRole } from "@/lib/auth/require-role";
import {
  createPayoutWorkbook,
  renderPayoutPdf,
  type PayoutExportDocument,
} from "@/lib/payouts/export";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  locale: z.enum(["ar", "en"]).default("ar"),
  format: z.enum(["pdf", "xlsx"]).default("pdf"),
});
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "invalid_request" }, { status: 400 });
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const authClient = await createClient();
  const { data: auth } = await authClient.auth.getUser();
  if (!auth.user) return Response.json({ error: "authentication_required" }, { status: 401 });
  const { data: viewerProfile } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!viewerProfile || (viewerProfile.role !== "admin" && viewerProfile.role !== "teacher"))
    return Response.json({ error: "forbidden" }, { status: 403 });
  await requireRole(viewerProfile.role, parsed.data.locale);
  const supabase = await createClient();
  const [payout, items, adjustments] = await Promise.all([
    supabase
      .from("teacher_payouts")
      .select("*,teacher:teachers(profile:profiles(full_name))")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("teacher_payout_items")
      .select("amount,rate_snapshot,kind,session:sessions(scheduled_at)")
      .eq("payout_id", id)
      .order("created_at"),
    supabase
      .from("teacher_adjustments")
      .select("kind,amount,reason")
      .eq("payout_id", id)
      .order("created_at"),
  ]);
  if (payout.error || items.error || adjustments.error || !payout.data)
    return Response.json({ error: "not_found" }, { status: 404 });
  const teacher = Array.isArray(payout.data.teacher) ? payout.data.teacher[0] : payout.data.teacher;
  const payoutProfile =
    teacher && (Array.isArray(teacher.profile) ? teacher.profile[0] : teacher.profile);
  const document: PayoutExportDocument = {
    locale: parsed.data.locale,
    payoutNo: payout.data.payout_no,
    teacher: payoutProfile?.full_name ?? "—",
    periodStart: payout.data.period_start,
    periodEnd: payout.data.period_end,
    currency: payout.data.currency,
    gross: Number(payout.data.gross),
    bonuses: Number(payout.data.bonuses),
    deductions: Number(payout.data.deductions),
    net: Number(payout.data.net),
    status: payout.data.status,
    items: (items.data ?? []).map((item) => {
      const session = Array.isArray(item.session) ? item.session[0] : item.session;
      return {
        date: session?.scheduled_at?.slice(0, 10) ?? "—",
        kind: item.kind,
        rate: Number(item.rate_snapshot),
        amount: Number(item.amount),
      };
    }),
    adjustments: (adjustments.data ?? []).map((item) => ({
      kind: item.kind,
      amount: Number(item.amount),
      reason: item.reason,
    })),
  };
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
  if (parsed.data.format === "xlsx") {
    const workbook = createPayoutWorkbook(document);
    return new Response(Uint8Array.from(workbook).buffer, {
      headers: {
        ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${document.payoutNo}.xlsx"`,
      },
    });
  }
  const pdf = await renderPayoutPdf(document);
  return new Response(Uint8Array.from(pdf).buffer, {
    headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${document.payoutNo}.pdf"`,
    },
  });
}
