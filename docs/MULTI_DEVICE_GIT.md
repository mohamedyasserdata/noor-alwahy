# العمل على مشروع نور الوحي من أكثر من جهاز

## ما تتم مزامنته

- الكود والمواصفات والهجرات والاختبارات.
- `AGENTS.md` لقواعد العمل الدائمة و`docs/PROJECT_STATUS.md` لنقطة الاستكمال الفعلية.
- مهارات المشروع داخل `.agents/skills/` وإصداراتها في `skills-lock.json`.

لا تتم مزامنة ملفات `.env*` المحلية، مفاتيح GitHub أو Supabase، إعدادات Codex الشخصية، أو
المسارات الخاصة بأي جهاز. يحصل كل جهاز على أسراره من المالك عبر قناة آمنة منفصلة.

## إعداد الجهاز الثاني مرة واحدة

المتطلبات: Git، Node.js 24، pnpm 11، Docker Desktop، وصلاحية قراءة وكتابة للمستودع الخاص.

```powershell
git clone <PRIVATE_REPOSITORY_URL> noor-alwahy
Set-Location noor-alwahy
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm supabase:start
pnpm db:reset
```

املأ `.env.local` محليًا بالقيم المصرح بها ولا تضفه إلى Git. بعد ذلك افتح المشروع في Codex؛
سيقرأ `AGENTS.md`. اطلب منه قراءة `docs/PROJECT_STATUS.md` ومتابعة المهمة النشطة فقط.

## بدء جلسة عمل بأمان

```powershell
git status --short
git fetch --prune
git switch main
git pull --ff-only
```

إذا كانت المهمة غير مكتملة، أنشئ فرعًا خاصًا بها بدل العمل على `main`:

```powershell
git switch -c work/p3-t01-sessions
```

قبل تعديل مهمة من جهاز آخر، تأكد من عدم وجود فرع نشط لنفس المهمة ومن سطر المهمة النشطة في
`docs/PROJECT_STATUS.md`. القاعدة هي جهاز/كاتب واحد لكل فرع ومهمة.

## حفظ نقطة تقدم غير مكتملة

1. حدّث `docs/PROJECT_STATUS.md` بالمنجز، الفحص الفعلي، العائق، والخطوة التالية الدقيقة.
2. راجع `git diff` وتأكد أن ملفات الأسرار غير موجودة.
3. احفظ وادفع الفرع نفسه:

```powershell
git add <FILES_REVIEWED_EXPLICITLY>
git commit -m "checkpoint(P3-T01): describe verified progress"
git push -u origin work/p3-t01-sessions
```

لا تستخدم `git add .` عند وجود ملفات محلية غير معروفة، ولا تستخدم `--force` أو
`--force-with-lease` مطلقًا.

## إكمال مهمة

- شغّل اختبارات المهمة، ثم بوابة المرحلة عندما تكون المهمة الأخيرة فيها.
- حدّث `PROJECT_STATUS.md` بالنتائج الحقيقية، وأنشئ Commit نهائيًا مستقلًا.
- ادفع الفرع وافتح Pull Request، وتأكد من نجاح GitHub Actions قبل دمجه في `main`.
- بعد الدمج، حدّث كل جهاز باستخدام `git switch main` ثم `git pull --ff-only`.

## التعامل مع التعارض

توقف عن التعديل، نفّذ `git fetch --prune`، وحدد أي جهاز يملك المهمة. لا تحذف تغييرات ولا تعيد
كتابة التاريخ. ادمج التعديلات بعد مراجعتها، وشغّل الاختبارات المتأثرة قبل الدفع.
