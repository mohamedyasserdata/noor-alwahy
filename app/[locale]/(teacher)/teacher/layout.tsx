import { PortalLayoutRoute } from "@/components/portal/portal-routes";

export default function TeacherLayout(props: LayoutProps<"/[locale]/teacher">) {
  return <PortalLayoutRoute {...props} portal="teacher" />;
}
