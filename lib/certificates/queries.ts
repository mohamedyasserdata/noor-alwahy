import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getCertificateAdminData() {
  await connection();
  const supabase = await createClient();
  const [templates, versions, certificates, batches, students] = await Promise.all([
    supabase
      .from("certificate_templates")
      .select("id,kind,name_ar,name_en,is_active")
      .order("created_at", { ascending: false }),
    supabase
      .from("certificate_template_versions")
      .select(
        "id,template_id,version,status,title_ar,title_en,body_ar,body_en,logo_path,seal_path,signatures,theme,published_at",
      )
      .order("version", { ascending: false }),
    supabase
      .from("certificates")
      .select(
        "id,student_id,kind,serial_no,locale,issued_at,revoked_at,student:students(full_name)",
      )
      .order("issued_at", { ascending: false })
      .limit(100),
    supabase
      .from("certificate_batches")
      .select("id,status,total_count,completed_count,failed_count,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("students").select("id,full_name").eq("status", "active").order("full_name"),
  ]);
  if (templates.error || versions.error || certificates.error || batches.error || students.error)
    throw new Error("certificate_management_unavailable");
  return {
    templates: templates.data ?? [],
    versions: versions.data ?? [],
    certificates: certificates.data ?? [],
    batches: batches.data ?? [],
    students: students.data ?? [],
  };
}

export async function getMyCertificates() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificates")
    .select("id,kind,serial_no,locale,issued_at,revoked_at,payload_snapshot")
    .order("issued_at", { ascending: false });
  if (error) throw new Error("certificates_unavailable");
  return data ?? [];
}
