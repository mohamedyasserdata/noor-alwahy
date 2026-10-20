import { describe, expect, it } from "vitest";

import {
  evaluationDraftStorageKey,
  evaluationDraftVersion,
  parseEvaluationDraft,
} from "../../lib/evaluation/draft";

const validDraft = {
  version: evaluationDraftVersion,
  sessionType: "recitation",
  fromSurah: 1,
  fromAyah: 1,
  toSurah: 1,
  toAyah: 7,
  scores: { fluency: 4 },
  errorsMajor: 0,
  errorsMinor: 1,
  promptsCount: 0,
  forgotCount: 0,
  weakTags: "وقف",
  decision: "passed",
  homework: "مراجعة الفاتحة",
  familyNote: "تقدم جيد",
};

describe("evaluation local draft", () => {
  it("uses a versioned per-session key", () => {
    expect(evaluationDraftStorageKey("session-1")).toBe("noor:evaluation-draft:v1:session-1");
  });

  it("restores a valid versioned draft", () => {
    expect(parseEvaluationDraft(JSON.stringify(validDraft))).toEqual(validDraft);
  });

  it("rejects malformed JSON, stale versions, and invalid scores", () => {
    expect(parseEvaluationDraft("{")).toBeNull();
    expect(parseEvaluationDraft(JSON.stringify({ ...validDraft, version: 0 }))).toBeNull();
    expect(
      parseEvaluationDraft(JSON.stringify({ ...validDraft, scores: { fluency: 9 } })),
    ).toBeNull();
  });
});
