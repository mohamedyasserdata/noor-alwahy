# Admin Frontend Inventory — 2026-10-28

## Scope and guardrails

- Frontend-only redesign scoped by `.admin-workspace` and `.admin-page`.
- No API, database, RLS, authentication, or business-logic files were changed.
- Existing forms, controls, filters, tables, exports, navigation, and server actions remain in place.
- Real dashboard queries and empty states remain the only data sources; no mock data was added.
- Local pre-change copies are stored under `output/local-backups/admin-frontend-20261028-0015`.

## Admin routes retained

| Group                     | Sections                                                                                 | Existing capability retained                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Overview                  | Dashboard, Control centre                                                                | Live operational metrics, date/country/currency filters, PDF/XLSX exports, risk and activity views        |
| People and requests       | Enrollment applications, Teacher applications, Students, Teachers, Assignments, Accounts | Review, create, update, export/import, invite, activate/deactivate, matching, and audited actions         |
| Learning and follow-up    | Schedule, Attendance, Evaluation setup, Exams, Reports, Certificates                     | Weekly scheduling, attendance oversight, scoring settings, grades, publication, PDF/certificate workflows |
| Finance and subscriptions | Packages, Subscriptions, Finance                                                         | Package and country pricing, subscription periods, invoices, payments, receipts, exports                  |
| Content and communication | Announcements, Templates                                                                 | Targeted announcements and versioned content templates                                                    |
| System and settings       | Audit log, Academy settings                                                              | Audit filtering and academy policy/profile settings                                                       |

The attendance route already existed in the application but was absent from the admin navigation configuration. It is now exposed as a frontend navigation link without changing its backend behavior.

## Shared frontend changes

- Scrollable, grouped admin sidebar with all 21 section links.
- Desktop admin topbar with the existing account menu, notifications, language switcher, and theme toggle.
- Account details removed from the sidebar to avoid duplication; mobile account access remains in the mobile header.
- Cream/navy/gold workspace, rounded white cards, subtle borders and shadows, pastel metric icons, refined forms and tables.
- Admin-only responsive rules at 360px, 768px, and 1440px; teacher, student, parent, and public shells are untouched.
- Arabic RTL, English LTR, light mode, and dark mode retained.

## Information-architecture refinement

- The desktop sidebar now exposes seven clear entry points: dashboard, students and enrollment, teachers and assignments, academic operations, finance and subscriptions, content and communication, and administration/system.
- Every original admin route remains available inside its group; no function or permission was removed.
- The mobile navigation now shows four frequent destinations plus a **More** panel containing every remaining section, replacing the crowded 21-link strip.
- The dashboard defaults to four operational KPIs, a real-data attention queue, and four quick actions.
- Filters and detailed analytics remain available but are collapsed by default, keeping all charts, exports, risk indicators, package distribution, and audited activity accessible without dominating the first view.
- A route-level admin error boundary now provides a recoverable, bilingual message instead of exposing an internal runtime code to administrators.
- The subscriptions query now names the current-package foreign-key relationship explicitly. This resolves the ambiguous package embed introduced when the scheduled-package relationship was added; no schema, RLS, or stored data was changed.

## Functional inventory before the redesign

The audit covered 43 admin-related component files. The existing surface includes forms and controls for academy settings, assignments, audit filters, official contact links, evaluation settings, Excel student import, student/teacher/user management, announcements, enrollment CRM, attendance, finance, certificates, templates, intervention workflows, dashboard filters and exports, exams, packages and pricing, scheduling and adjustments, subscriptions, reports, and teacher applications.

## Verification summary

- TypeScript: passed.
- ESLint plus logical-CSS and no-internal-messaging checks: passed.
- Production build: passed, including 186 generated static pages.
- Vitest: 30 files, 148 tests passed.
- New admin visual/responsive Playwright suite: 4/4 passed and visited all 21 admin sections, including subscriptions.
- Portal shell and responsive navigation: 11/11 passed across Arabic, English, mobile, tablet, desktop, dark mode, and short laptop heights.
- Selected administration workflows: 17/17 passed across settings, applications, attendance, audit access, evaluation, packages, reports, interventions, session adjustments, assignments, students, teachers, users, and schedules. The teacher workflow needed a 20-second navigation assertion because the accumulated local fixture set makes its full-page re-render slower than the former five-second expectation.
- The separate teacher-invitation journey can still generate a link using an expired Quick Tunnel hostname when the already-running local Supabase Auth container retains its previous external URL. This is a local runtime configuration issue, not an admin frontend or database-schema failure; no Auth/backend setting was changed as part of this frontend task.

## Screenshots

- `output/screenshots/admin-dashboard-ar-360.png`
- `output/screenshots/admin-dashboard-ar-768.png`
- `output/screenshots/admin-dashboard-ar-1440.png`
- `output/screenshots/admin-dashboard-en-dark-1440.png`
- `output/screenshots/admin-mobile-menu-ar-360.png`
