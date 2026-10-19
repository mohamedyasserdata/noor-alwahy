export const portalIds = ["admin", "teacher", "student", "parent"] as const;

export type PortalId = (typeof portalIds)[number];

export const portalConfig = {
  admin: {
    defaultSection: "dashboard",
    sections: [
      "dashboard",
      "applications",
      "students",
      "teachers",
      "assignments",
      "users",
      "audit",
      "settings",
    ],
  },
  teacher: {
    defaultSection: "today",
    sections: ["today", "students", "reports", "availability"],
  },
  student: {
    defaultSection: "home",
    sections: ["home", "progress", "schedule", "certificates", "contact"],
  },
  parent: {
    defaultSection: "children",
    sections: ["children", "billing", "contact"],
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
