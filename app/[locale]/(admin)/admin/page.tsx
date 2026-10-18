import { PortalIndexRoute } from "@/components/portal/portal-routes";

export default function AdminIndexPage({ params }: PageProps<"/[locale]/admin">) {
  return <PortalIndexRoute params={params} portal="admin" />;
}
