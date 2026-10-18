import { PortalIndexRoute } from "@/components/portal/portal-routes";

export default function ParentIndexPage({ params }: PageProps<"/[locale]/parent">) {
  return <PortalIndexRoute params={params} portal="parent" />;
}
