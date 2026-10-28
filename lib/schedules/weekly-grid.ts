export type WeeklyGridSlot = {
  slot_id: string;
  weekday: number;
  local_start_time: string;
  viewer: { weekday: number; time: string } | null;
};

export function buildWeeklyScheduleGrid<T extends WeeklyGridSlot>(slots: T[]) {
  const normalized = slots.map((slot) => ({
    ...slot,
    displayDay: slot.viewer?.weekday ?? slot.weekday,
    displayTime: (slot.viewer?.time ?? slot.local_start_time).slice(0, 5),
  }));
  const times = [...new Set(normalized.map((slot) => slot.displayTime))].sort((a, b) =>
    a.localeCompare(b),
  );
  const slotsByCell = new Map<string, typeof normalized>();
  for (const slot of normalized) {
    const key = `${slot.displayDay}-${slot.displayTime}`;
    const current = slotsByCell.get(key) ?? [];
    current.push(slot);
    slotsByCell.set(key, current);
  }

  return { times, slotsByCell };
}
