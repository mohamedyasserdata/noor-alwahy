import { PortalIndexRoute } from "@/components/portal/portal-routes";

export default function StudentIndexPage({ params }: PageProps<"/[locale]/student">) {
  return <PortalIndexRoute params={params} portal="student" />;
}
