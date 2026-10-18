import { PortalLayoutRoute } from "@/components/portal/portal-routes";

export const instant = false;

export default function AdminLayout(props: LayoutProps<"/[locale]/admin">) {
  return <PortalLayoutRoute {...props} portal="admin" />;
}
