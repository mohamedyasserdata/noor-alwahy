import { createHash } from "node:crypto";

import { z } from "zod";

import { renderCertificatePdf, type CertificatePdfDocument } from "@/lib/certificates/pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.uuid() });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return new Response(null, { status: 404 });
  const client = await createClient();
  const { data: accessible, error: accessError } = await client
    .from("certificates")
    .select("id,revoked_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (accessError || !accessible || accessible.revoked_at)
    return new Response(null, { status: 404 });

  const admin = createAdminClient();
  const { data: certificate, error } = await admin
    .from("certificates")
    .select("id,serial_no,verify_code,locale,payload_snapshot,template_snapshot,pdf_sha256")
    .eq("id", accessible.id)
    .single();
  if (error) return new Response(null, { status: 404 });
  const template = certificate.template_snapshot as CertificatePdfDocument["template"] & {
    logo_path?: string;
    seal_path?: string;
  };
  const signatures = Array.isArray(template.signatures)
    ? (template.signatures as Record<string, unknown>[])
    : [];
  const signaturePaths = signatures
    .map((signature) => signature.image_path)
    .filter((value): value is string => typeof value === "string");
  const [logo, seal, ...signatureAssets] = await Promise.all([
    downloadAsset(admin, template.logo_path),
    downloadAsset(admin, template.seal_path),
    ...signaturePaths.map((path) => downloadAsset(admin, path)),
  ]);
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = configured ? new URL(configured).origin : new URL(request.url).origin;
  const verifyUrl = new URL(
    `/${certificate.locale}/verify/${certificate.verify_code}`,
    origin,
  ).toString();
  try {
    const pdf = await renderCertificatePdf({
      locale: certificate.locale as "ar" | "en",
      serialNo: certificate.serial_no,
      verifyUrl,
      payload: certificate.payload_snapshot as CertificatePdfDocument["payload"],
      template,
      assets: {
        ...(logo ? { logo } : {}),
        ...(seal ? { seal } : {}),
        signatures: Object.fromEntries(
          signaturePaths
            .map((path, index) => [path, signatureAssets[index]])
            .filter((entry): entry is [string, string] => Boolean(entry[1])),
        ),
      },
    });
    const hash = createHash("sha256").update(pdf).digest("hex");
    if (!certificate.pdf_sha256)
      await admin
        .from("certificates")
        .update({ pdf_sha256: hash, pdf_path: `generated:${certificate.id}` })
        .eq("id", certificate.id)
        .is("pdf_sha256", null);
    return new Response(Uint8Array.from(pdf).buffer, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="certificate-${certificate.serial_no}.pdf"`,
        "Content-Type": "application/pdf",
        "X-Certificate-SHA256": hash,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (pdfError) {
    console.error(
      "certificate_pdf_generation_failed",
      pdfError instanceof Error ? pdfError.message : "unknown_error",
    );
    return Response.json({ error: "pdf_generation_failed" }, { status: 503 });
  }
}

async function downloadAsset(admin: ReturnType<typeof createAdminClient>, path?: string) {
  if (!path) return undefined;
  const { data, error } = await admin.storage.from("certificate-assets").download(path);
  if (error) return undefined;
  const type =
    data.type && ["image/png", "image/jpeg", "image/webp"].includes(data.type)
      ? data.type
      : "image/png";
  return `data:${type};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}
