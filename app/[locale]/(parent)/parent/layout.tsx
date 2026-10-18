import { PortalLayoutRoute } from "@/components/portal/portal-routes";

export const instant = false;

export default function ParentLayout(props: LayoutProps<"/[locale]/parent">) {
  return <PortalLayoutRoute {...props} portal="parent" />;
}
