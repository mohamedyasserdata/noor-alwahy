import { PortalLayoutRoute } from "@/components/portal/portal-routes";

export default function AdminLayout(props: LayoutProps<"/[locale]/admin">) {
  return <PortalLayoutRoute {...props} portal="admin" />;
}
