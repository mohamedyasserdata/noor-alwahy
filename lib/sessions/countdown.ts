export const JOIN_BEFORE_MS = 10 * 60 * 1000;
export const JOIN_AFTER_MS = 15 * 60 * 1000;

export type JoinWindowState =
  | { phase: "before"; remainingSeconds: number; canJoin: false }
  | { phase: "open"; remainingSeconds: number; canJoin: true }
  | { phase: "closed"; remainingSeconds: 0; canJoin: false };

export function getJoinWindowState(
  nowMs: number,
  scheduledAtMs: number,
  endsAtMs: number,
): JoinWindowState {
  const opensAtMs = scheduledAtMs - JOIN_BEFORE_MS;
  const closesAtMs = endsAtMs + JOIN_AFTER_MS;

  if (nowMs < opensAtMs) {
    return {
      phase: "before",
      remainingSeconds: Math.max(1, Math.ceil((opensAtMs - nowMs) / 1000)),
      canJoin: false,
    };
  }

  if (nowMs <= closesAtMs) {
    return {
      phase: "open",
      remainingSeconds: Math.max(0, Math.ceil((closesAtMs - nowMs) / 1000)),
      canJoin: true,
    };
  }

  return { phase: "closed", remainingSeconds: 0, canJoin: false };
}

export function formatCountdown(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
