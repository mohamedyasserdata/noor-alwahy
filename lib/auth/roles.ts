import type { AppLocale } from "@/i18n/routing";

export const userRoles = ["admin", "teacher", "student", "parent"] as const;

export type UserRole = (typeof userRoles)[number];

const roleHomes = {
  admin: "/admin/dashboard",
  teacher: "/teacher/today",
  student: "/student/home",
  parent: "/parent/children",
} as const satisfies Record<UserRole, string>;

export function parseUserRole(value: unknown): UserRole | null {
  return typeof value === "string" && (userRoles as readonly string[]).includes(value)
    ? (value as UserRole)
    : null;
}

export function getRoleHome(role: UserRole, locale: AppLocale) {
  return `/${locale}${roleHomes[role]}`;
}

export function getPortalRoleFromPath(pathname: string): {
  locale: AppLocale;
  role: UserRole;
} | null {
  const match = pathname.match(/^\/(ar|en)\/(admin|teacher|student|parent)(?:\/|$)/);

  if (!match) {
    return null;
  }

  return {
    locale: match[1] as AppLocale,
    role: match[2] as UserRole,
  };
}

export function getSafeLocalizedPath(value: string | null, locale: AppLocale) {
  const fallback = `/${locale}/auth/login`;

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://noor-alwahy.invalid");

    if (
      parsed.origin !== "https://noor-alwahy.invalid" ||
      !parsed.pathname.startsWith(`/${locale}/`)
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
