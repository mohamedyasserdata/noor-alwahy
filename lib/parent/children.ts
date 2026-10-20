import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function getGuardianChildren() {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("guardian_auth_required");
  const { data: guardian, error: guardianError } = await supabase
    .from("guardians")
    .select("id")
    .eq("profile_id", auth.user.id)
    .single();
  if (guardianError) throw new Error("guardian_unavailable");
  const { data, error } = await supabase
    .from("student_guardians")
    .select("student_id,is_primary,students!student_guardians_student_id_fkey(full_name)")
    .eq("guardian_id", guardian.id)
    .order("is_primary", { ascending: false });
  if (error) throw new Error("guardian_children_unavailable");
  return (data ?? []).map((link) => ({
    id: link.student_id,
    name: link.students.full_name,
    primary: link.is_primary,
  }));
}
