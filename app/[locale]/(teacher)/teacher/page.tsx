import { PortalIndexRoute } from "@/components/portal/portal-routes";

export default function TeacherIndexPage({ params }: PageProps<"/[locale]/teacher">) {
  return <PortalIndexRoute params={params} portal="teacher" />;
}
