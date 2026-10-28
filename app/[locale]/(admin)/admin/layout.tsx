import { PortalLayoutRoute } from "@/components/portal/portal-routes";

export const instant = false;

export default function AdminLayout({ children, ...props }: LayoutProps<"/[locale]/admin">) {
  return (
    <PortalLayoutRoute {...props} portal="admin">
      <div className="admin-page">{children}</div>
    </PortalLayoutRoute>
  );
}
