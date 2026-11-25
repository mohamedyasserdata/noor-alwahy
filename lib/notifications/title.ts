import type { useTranslations } from "next-intl";

export function notificationTitle(
  type: string,
  t: ReturnType<typeof useTranslations<"notifications">>,
) {
  if (type === "schedule_changed") return t("types.scheduleChanged");
  if (type === "zoom_link_changed") return t("types.zoomLinkChanged");
  if (type === "teacher_late") return t("types.teacherLate");
  if (type === "teacher_absence_threshold") return t("types.teacherAbsenceThreshold");
  if (type === "report_approved") return t("types.reportApproved");
  if (type === "payment_confirmed") return t("types.paymentConfirmed");
  if (type === "refund_confirmed") return t("types.refundConfirmed");
  if (type === "subscription_renewal_due") return t("types.subscriptionRenewalDue");
  if (type === "announcement") return t("types.announcement");
  if (type === "intervention_opened") return t("types.interventionOpened");
  if (type === "intervention_escalated") return t("types.interventionEscalated");
  return t("types.generic");
}
