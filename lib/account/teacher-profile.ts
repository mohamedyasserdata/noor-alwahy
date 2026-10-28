import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getTeacherProfileSettings() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [profileResult, privateResult, teacherResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,display_name,timezone,preferred_locale")
      .eq("id", userData.user.id)
      .single(),
    supabase
      .from("profile_private")
      .select("contact_email")
      .eq("profile_id", userData.user.id)
      .maybeSingle(),
    supabase.from("teachers").select("id,status").eq("profile_id", userData.user.id).maybeSingle(),
  ]);
  if (profileResult.error || privateResult.error || teacherResult.error) {
    throw new Error("teacher_profile_unavailable");
  }
  return {
    email: userData.user.email ?? privateResult.data?.contact_email ?? "",
    profile: profileResult.data,
    teacher: teacherResult.data,
  };
}
