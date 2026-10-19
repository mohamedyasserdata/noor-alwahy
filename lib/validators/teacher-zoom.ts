import { z } from "zod";

export function isAllowedZoomUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      (host === "zoom.us" ||
        host.endsWith(".zoom.us") ||
        host === "zoom.com" ||
        host === "zoomgov.com" ||
        host.endsWith(".zoomgov.com"))
    );
  } catch {
    return false;
  }
}

export const teacherZoomSchema = z.object({
  joinUrl: z.string().trim().min(12).max(2048).refine(isAllowedZoomUrl),
});
