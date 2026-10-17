# نظام أكاديمية نور الوحي

تطبيق إدارة الأكاديمية المبني بأسلوب Spec-Driven Development. المصدر التنفيذي داخل
`specs/001-noor-alwahy`، والقواعد غير القابلة للتفاوض داخل
`.specify/memory/constitution.md`.

## التشغيل المحلي

```bash
pnpm install
pnpm dev
```

افتح <http://localhost:3000>. في المرحلة الحالية يعاد توجيه الجذر إلى `/dev/ui`، وهو مرجع
نظام التصميم بالاتجاهين.

## بوابة الجودة المتاحة الآن

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

يتطلب تشغيل مراحل Supabase اللاحقة Docker وSupabase CLI؛ راجع
`docs/PROJECT_STATUS.md` للحالة الدقيقة والأوامر التي تم التحقق منها.

## أهم الملفات

- `docs/PROJECT_STATUS.md`: سجل الاستمرار لأي مطوّر أو نموذج آخر.
- `docs/adr/ADR-001-versions.md`: الإصدارات والقيود المتغيرة في Next.js.
- `docs/adr/ADR-002-design-system.md`: قرارات الهوية والخطوط والمكوّنات.
- `app/dev/ui/page.tsx`: مرجع التصميم الحي.
