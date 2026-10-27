import { z } from "zod";

import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({ locale: z.enum(["ar", "en"]).default("ar") });
const paramsSchema = z.object({ id: z.uuid() });

export async function GET(
  request: Request,
  context: RouteContext<"/api/admin/teacher-applications/[id]/cv">,
) {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const params = paramsSchema.safeParse(await context.params);
  if (!query.success || !params.success) return new Response(null, { status: 400 });
  await requireRole("admin", query.data.locale);

  const supabase = await createClient();
  const { data: application, error } = await supabase
    .from("teacher_applications")
    .select("cv_path,cv_name")
    .eq("id", params.data.id)
    .maybeSingle();
  if (error || !application?.cv_path || !application.cv_name) {
    return new Response(null, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error: downloadError } = await admin.storage
    .from("teacher-applications")
    .download(application.cv_path);
  if (downloadError) return new Response(null, { status: 404 });
  const fileName = application.cv_name.replace(/["\r\n]/gu, "-");
  return new Response(await data.arrayBuffer(), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Type": data.type || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
