import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";

export function generateStaticParams() {
  return getPortalStaticParams("parent");
}

export default function ParentSectionPage({ params }: PageProps<"/[locale]/parent/[section]">) {
  return <PortalSectionRoute params={params} portal="parent" />;
}
