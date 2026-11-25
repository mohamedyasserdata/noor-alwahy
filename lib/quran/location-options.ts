export type QuranLocationOption = {
  id: number;
  nameAr: string;
  nameEn: string;
  firstPage: number;
  lastPage: number;
};

type SurahRow = { id: number; name_ar: string; name_en: string };
type PageRow = {
  page: number;
  first_ayah: { surah_id: number } | { surah_id: number }[] | null;
  last_ayah: { surah_id: number } | { surah_id: number }[] | null;
};

export function buildQuranLocationOptions(surahs: SurahRow[], pages: PageRow[]) {
  return surahs.map((surah) => {
    const matching = pages.filter((page) => {
      const first = one(page.first_ayah)?.surah_id;
      const last = one(page.last_ayah)?.surah_id;
      return first !== undefined && last !== undefined && first <= surah.id && last >= surah.id;
    });
    return {
      id: surah.id,
      nameAr: surah.name_ar,
      nameEn: surah.name_en,
      firstPage: matching[0]?.page ?? 1,
      lastPage: matching.at(-1)?.page ?? 1,
    } satisfies QuranLocationOption;
  });
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
