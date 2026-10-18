import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";

export function generateStaticParams() {
  return getPortalStaticParams("admin");
}

export default function AdminSectionPage({ params }: PageProps<"/[locale]/admin/[section]">) {
  return <PortalSectionRoute params={params} portal="admin" />;
}
