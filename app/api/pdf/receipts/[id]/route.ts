import { z } from "zod";

import { renderReceiptPdf } from "@/lib/billing/receipt-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.uuid() });
const querySchema = z.object({ locale: z.enum(["ar", "en"]).default("ar") });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedQuery = querySchema.safeParse({
    locale: new URL(request.url).searchParams.get("locale") ?? "ar",
  });
  if (!parsedParams.success || !parsedQuery.success) return new Response(null, { status: 404 });

  const client = await createClient();
  const { data: accessible, error: accessError } = await client
    .from("payments")
    .select("id")
    .eq("id", parsedParams.data.id)
    .eq("status", "confirmed")
    .maybeSingle();
  if (accessError || !accessible) return new Response(null, { status: 404 });

  const admin = createAdminClient();
  const { data: payment, error } = await admin
    .from("payments")
    .select("id,invoice_id,kind,amount,currency,paid_at,confirmed_at,receipt_no,payment_method_id")
    .eq("id", accessible.id)
    .single();
  if (error || !payment.receipt_no || !payment.confirmed_at)
    return new Response(null, { status: 404 });
  const [invoiceResult, methodResult] = await Promise.all([
    admin.from("invoices").select("invoice_no,student_id").eq("id", payment.invoice_id).single(),
    payment.payment_method_id
      ? admin
          .from("payment_methods")
          .select("label_ar,label_en")
          .eq("id", payment.payment_method_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (invoiceResult.error) return new Response(null, { status: 404 });
  const { data: student, error: studentError } = await admin
    .from("students")
    .select("full_name")
    .eq("id", invoiceResult.data.student_id)
    .single();
  if (studentError) return new Response(null, { status: 404 });

  try {
    const locale = parsedQuery.data.locale;
    const pdf = await renderReceiptPdf({
      locale,
      receiptNo: payment.receipt_no,
      invoiceNo: invoiceResult.data.invoice_no,
      studentName: student.full_name,
      kind: payment.kind,
      amount: String(payment.amount),
      currency: payment.currency,
      method: methodResult.data
        ? locale === "ar"
          ? methodResult.data.label_ar
          : (methodResult.data.label_en ?? methodResult.data.label_ar)
        : null,
      paidAt: payment.paid_at,
      confirmedAt: payment.confirmed_at,
    });
    return new Response(Uint8Array.from(pdf).buffer, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="receipt-${payment.receipt_no}.pdf"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (pdfError) {
    console.error(
      "receipt_pdf_generation_failed",
      pdfError instanceof Error ? pdfError.message : "unknown_error",
    );
    return Response.json({ error: "pdf_generation_failed" }, { status: 503 });
  }
}
