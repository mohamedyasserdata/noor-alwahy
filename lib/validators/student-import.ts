import { studentFormSchema } from "./students";

export const studentImportHeaders = [
  "full_name",
  "gender",
  "birth_date",
  "joined_at",
  "country_code",
  "timezone",
  "track_code",
  "level_name",
  "health_notes",
  "special_notes",
  "share_with_teacher",
] as const;

export type ImportLevel = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  trackCode: string;
};

export type StudentImportError = { row: number; column: string; code: string };

export function validateStudentImportRows(
  rows: string[][],
  levels: ImportLevel[],
  existingStudents: Array<{ fullName: string; birthDate: string | null }>,
) {
  const errors: StudentImportError[] = [];
  const payload: Array<Record<string, string | boolean | null>> = [];
  const seen = new Set<string>();
  const existing = new Set(
    existingStudents.map(({ fullName, birthDate }) => duplicateKey(fullName, birthDate)),
  );

  rows.forEach((cells, index) => {
    const row = index + 2;
    const values = Object.fromEntries(
      studentImportHeaders.map((header, column) => [header, (cells[column] ?? "").trim()]),
    );
    const trackCode = values.track_code?.toLowerCase() ?? "";
    const levelName = values.level_name?.toLocaleLowerCase() ?? "";
    let levelId: string | null = null;
    if (trackCode || levelName) {
      const level = levels.find(
        (candidate) =>
          candidate.trackCode.toLowerCase() === trackCode &&
          [candidate.nameAr, candidate.nameEn]
            .filter((name): name is string => Boolean(name))
            .some((name) => name.toLocaleLowerCase() === levelName),
      );
      if (!trackCode || !levelName || !level)
        errors.push({ row, column: "level_name", code: "unknown_level" });
      else levelId = level.id;
    }

    const shareValue = values.share_with_teacher?.toLowerCase();
    if (shareValue !== "true" && shareValue !== "false") {
      errors.push({ row, column: "share_with_teacher", code: "invalid_boolean" });
    }

    const parsed = studentFormSchema.safeParse({
      studentId: null,
      fullName: values.full_name,
      gender: values.gender,
      birthDate: values.birth_date || undefined,
      status: "active",
      levelId,
      joinedAt: values.joined_at,
      countryCode: values.country_code || undefined,
      timezone: values.timezone,
      healthNotes: values.health_notes || undefined,
      specialNotes: values.special_notes || undefined,
      shareWithTeacher: shareValue === "true" ? "true" : "false",
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ row, column: String(issue.path[0] ?? "row"), code: issue.message });
      }
      return;
    }

    const key = duplicateKey(parsed.data.fullName, parsed.data.birthDate);
    if (seen.has(key) || existing.has(key)) {
      errors.push({ row, column: "full_name", code: "duplicate_student" });
      return;
    }
    seen.add(key);
    payload.push({
      birth_date: parsed.data.birthDate,
      country_code: parsed.data.countryCode,
      full_name: parsed.data.fullName,
      gender: parsed.data.gender,
      health_notes: parsed.data.healthNotes,
      joined_at: parsed.data.joinedAt,
      level_id: parsed.data.levelId,
      share_with_teacher: parsed.data.shareWithTeacher,
      special_notes: parsed.data.specialNotes,
      status: parsed.data.status,
      student_id: null,
      timezone: parsed.data.timezone,
    });
  });

  return { errors, payload };
}

function duplicateKey(fullName: string, birthDate: string | null) {
  return `${fullName.trim().toLocaleLowerCase()}|${birthDate ?? ""}`;
}
