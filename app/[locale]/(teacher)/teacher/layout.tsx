import { PortalLayoutRoute } from "@/components/portal/portal-routes";

export const instant = false;

export default function TeacherLayout(props: LayoutProps<"/[locale]/teacher">) {
  return <PortalLayoutRoute {...props} portal="teacher" />;
}
