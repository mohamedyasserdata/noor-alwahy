type PageMetadata = {
  page: number;
  juz: number;
  firstSurahId: number;
  lastSurahId: number;
};

type ProgressRecord = {
  page: number;
  status: string;
  updated_at: string;
};

export function calculateProgressSummary(
  pages: readonly PageMetadata[],
  progress: readonly ProgressRecord[],
) {
  const pageByNumber = new Map(pages.map((page) => [page.page, page]));
  const latestActive = progress
    .filter((row) => row.status !== "not_started")
    .toSorted((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const currentJuz = pageByNumber.get(latestActive?.page ?? 1)?.juz ?? 1;
  const currentJuzPages = pages.filter((page) => page.juz === currentJuz);
  const masteredPages = new Set(
    progress.filter((row) => row.status === "mastered").map((row) => row.page),
  );
  const currentJuzMastered = currentJuzPages.filter((page) => masteredPages.has(page.page));
  const currentJuzSurahs = new Set<number>();
  for (const page of currentJuzMastered) {
    for (let id = page.firstSurahId; id <= page.lastSurahId; id += 1) currentJuzSurahs.add(id);
  }

  return {
    currentJuz: {
      number: currentJuz,
      masteredPages: currentJuzMastered.length,
      totalPages: currentJuzPages.length,
      surahCount: currentJuzSurahs.size,
      percent: currentJuzPages.length
        ? Math.round((currentJuzMastered.length / currentJuzPages.length) * 100)
        : 0,
    },
    overall: {
      masteredPages: masteredPages.size,
      percent: Math.round((masteredPages.size / 604) * 100),
    },
  };
}
