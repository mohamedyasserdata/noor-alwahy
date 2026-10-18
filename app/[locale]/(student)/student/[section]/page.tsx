import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";

export function generateStaticParams() {
  return getPortalStaticParams("student");
}

export default function StudentSectionPage({ params }: PageProps<"/[locale]/student/[section]">) {
  return <PortalSectionRoute params={params} portal="student" />;
}
