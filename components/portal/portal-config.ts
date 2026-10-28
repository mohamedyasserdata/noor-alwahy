export const portalIds = ["admin", "teacher", "student", "parent"] as const;

export type PortalId = (typeof portalIds)[number];

export const portalConfig = {
  admin: {
    defaultSection: "dashboard",
    sections: [
      "dashboard",
      "control-center",
      "packages",
      "applications",
      "teacher-applications",
      "subscriptions",
      "finance",
      "students",
      "teachers",
      "assignments",
      "schedule",
      "attendance",
      "evaluation",
      "exams",
      "certificates",
      "reports",
      "announcements",
      "templates",
      "users",
      "audit",
      "settings",
    ],
  },
  teacher: {
    defaultSection: "today",
    sections: [
      "today",
      "evaluations",
      "students",
      "reports",
      "availability",
      "schedule",
      "zoom",
      "earnings",
      "exams",
    ],
  },
  student: {
    defaultSection: "home",
    sections: ["home", "progress", "schedule", "billing", "certificates", "contact"],
  },
  parent: {
    defaultSection: "home",
    sections: ["home", "children", "schedule", "billing", "contact"],
  },
} as const satisfies Record<
  PortalId,
  {
    defaultSection: string;
    sections: readonly string[];
  }
>;

export type PortalSectionId<TPortal extends PortalId = PortalId> =
  (typeof portalConfig)[TPortal]["sections"][number];

export function isPortalSection(portal: PortalId, section: string): section is PortalSectionId {
  return (portalConfig[portal].sections as readonly string[]).includes(section);
}
