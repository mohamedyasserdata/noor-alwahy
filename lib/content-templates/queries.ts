import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const versionSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string().uuid(),
  version_no: z.coerce.number().int().positive(),
  locale: z.enum(["ar", "en"]),
  subject_template: z.string().nullable(),
  body_template: z.string(),
  variables_schema: z.record(
    z.string(),
    z.object({ type: z.string(), fallback: z.string().optional() }),
  ),
  published_at: z.string().nullable(),
  created_at: z.string(),
});

const templateSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["student_report", "admin_message", "announcement"]),
  name_ar: z.string(),
  name_en: z.string().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  updated_at: z.string(),
});

export async function getContentTemplateLibrary() {
  await connection();
  const supabase = await createClient();
  const [templates, versions] = await Promise.all([
    supabase
      .from("content_templates")
      .select("id,kind,name_ar,name_en,status,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("content_template_versions")
      .select(
        "id,template_id,version_no,locale,subject_template,body_template,variables_schema,published_at,created_at",
      )
      .order("version_no", { ascending: false }),
  ]);
  if (templates.error || versions.error) throw new Error("content_templates_unavailable");
  return {
    templates: z.array(templateSchema).parse(templates.data ?? []),
    versions: z.array(versionSchema).parse(versions.data ?? []),
  };
}

export type ContentTemplateLibrary = Awaited<ReturnType<typeof getContentTemplateLibrary>>;
