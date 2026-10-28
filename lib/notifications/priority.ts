export function notificationPriority(type: string) {
  if (type === "schedule_changed" || type === "zoom_link_changed") return 1;
  if (type === "student_absence" || type === "student_absence_threshold") return 2;
  if (type === "invoice_due" || type === "subscription_renewal_due") return 3;
  if (type === "report_approved") return 4;
  if (type === "announcement") return 5;
  return 6;
}
