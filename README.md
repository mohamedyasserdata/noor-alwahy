# نظام أكاديمية نور الوحي

تطبيق إدارة الأكاديمية المبني بأسلوب Spec-Driven Development. المصدر التنفيذي داخل
`specs/001-noor-alwahy`، والقواعد غير القابلة للتفاوض داخل
`.specify/memory/constitution.md`.

## التشغيل المحلي

يتطلب تشغيل التطبيق Docker Desktop أو Podman لإقلاع Supabase المحلي. انسخ `.env.example`
إلى `.env.local` واملأ URL والمفتاح العام من ناتج CLI بعد الإقلاع، ثم نفّذ:

```bash
pnpm install
pnpm supabase:start
pnpm db:types
pnpm dev
```

افتح <http://localhost:3000>. يعاد توجيه الجذر إلى العربية ثم إلى `/ar/dev/ui`. ويمكن فتح
مرجع نظام التصميم الإنجليزي مباشرة من `/en/dev/ui` أو عبر مبدّل اللغة. صفحة التحقق من اتصال
Supabase متاحة محليًا في `/ar/dev/supabase` و`/en/dev/supabase`.

## بوابة الجودة المتاحة الآن

```bash
pnpm typecheck
pnpm lint
pnpm check:logical-css
pnpm format:check
pnpm build
```

Supabase CLI مثبت داخل المشروع، وDocker Desktop يعمل على جهاز التطوير. شُغّلت الحاويات،
ووُلّد `types/database.types.ts` من المخطط المحلي، ونجح استعلام Server Component الحقيقي؛
راجع `docs/PROJECT_STATUS.md` لأدلة التحقق ونقطة الاستئناف.

## أهم الملفات

- `docs/PROJECT_STATUS.md`: سجل الاستمرار لأي مطوّر أو نموذج آخر.
- `docs/adr/ADR-001-versions.md`: الإصدارات والقيود المتغيرة في Next.js.
- `docs/adr/ADR-002-design-system.md`: قرارات الهوية والخطوط والمكوّنات.
- `docs/adr/ADR-003-i18n-routing.md`: قرار المسارات المحلية وتركيب proxy.
- `app/[locale]/dev/ui/page.tsx`: مرجع التصميم الحي بالعربية والإنجليزية.
- `app/[locale]/dev/supabase/page.tsx`: فحص اتصال Data API من Server Component.
- `types/database.types.ts`: الأنواع المولّدة من مخطط PostgreSQL المحلي.
