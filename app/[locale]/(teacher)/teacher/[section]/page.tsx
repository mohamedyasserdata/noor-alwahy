import { getPortalStaticParams, PortalSectionRoute } from "@/components/portal/portal-routes";

export function generateStaticParams() {
  return getPortalStaticParams("teacher");
}

export default function TeacherSectionPage({ params }: PageProps<"/[locale]/teacher/[section]">) {
  return <PortalSectionRoute params={params} portal="teacher" />;
}
