import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StudentFamily = Awaited<ReturnType<typeof getStudentFamily>>;

export async function getStudentFamily(studentId: string) {
  const supabase = await createClient();
  const [{ data: student }, { data: parentProfiles }] = await Promise.all([
    supabase.from("students").select("profile_id").eq("id", studentId).maybeSingle(),
    supabase
      .from("profiles")
      .select("id,full_name,is_active")
      .eq("role", "parent")
      .order("full_name"),
  ]);

  const { data: links } = await supabase
    .from("student_guardians")
    .select("guardian_id,relation,is_primary,is_payer")
    .eq("student_id", studentId)
    .order("created_at");
  const guardianIds = (links ?? []).map(({ guardian_id }) => guardian_id);
  const { data: guardians } = guardianIds.length
    ? await supabase.from("guardians").select("id,profile_id").in("id", guardianIds)
    : { data: [] };
  const profileIds = [
    ...(parentProfiles ?? []).map(({ id }) => id),
    ...(student?.profile_id ? [student.profile_id] : []),
  ];
  const { data: privateProfiles } = profileIds.length
    ? await supabase
        .from("profile_private")
        .select("profile_id,contact_email")
        .in("profile_id", profileIds)
    : { data: [] };
  const emails = new Map(
    (privateProfiles ?? []).map(({ profile_id, contact_email }) => [profile_id, contact_email]),
  );
  const parents = new Map((parentProfiles ?? []).map((profile) => [profile.id, profile]));
  const guardianProfiles = new Map((guardians ?? []).map((row) => [row.id, row.profile_id]));

  return {
    studentAccount: student?.profile_id
      ? {
          profileId: student.profile_id,
          email: emails.get(student.profile_id) ?? null,
        }
      : null,
    parentOptions: (parentProfiles ?? [])
      .filter(({ is_active }) => is_active)
      .map((profile) => ({
        profileId: profile.id,
        fullName: profile.full_name,
        email: emails.get(profile.id) ?? null,
      })),
    guardianLinks: (links ?? []).flatMap((link) => {
      const profileId = guardianProfiles.get(link.guardian_id);
      const profile = profileId ? parents.get(profileId) : null;
      return profile
        ? [
            {
              guardianId: link.guardian_id,
              profileId: profile.id,
              fullName: profile.full_name,
              email: emails.get(profile.id) ?? null,
              relation: link.relation,
              isPrimary: link.is_primary,
              isPayer: link.is_payer,
            },
          ]
        : [];
    }),
  };
}
