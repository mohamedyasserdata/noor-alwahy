import { PortalLayoutRoute } from "@/components/portal/portal-routes";

export const instant = false;

export default function StudentLayout(props: LayoutProps<"/[locale]/student">) {
  return <PortalLayoutRoute {...props} portal="student" />;
}
