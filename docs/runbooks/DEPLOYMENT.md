# النشر والمراقبة — P11-T05

## البيئات

يجب إنشاء GitHub Environments مستقلين: `staging` و`production`، ولكل منهما مشروع Supabase
وقاعدة وStorage وأسرار ومفتاح cron وdeployment hook مستقل. الإنتاج يتطلب موافقة بشرية، ولا
تُنسخ بيانات مستخدمين حقيقية إلى staging.

## Workflow النشر

`Deploy` يدوي فقط: يربط المشروع المستهدف، يعرض migration dry-run، يطبق المهاجرات مرة واحدة،
يستدعي deployment hook، ثم ينتظر نجاح `/api/health`. يمنع concurrency نشرين لنفس البيئة ولا
يستخدم force أو تعديل تاريخ المهاجرات.

الأسرار المطلوبة داخل كل Environment: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`,
`SUPABASE_DB_PASSWORD`, `DEPLOY_HOOK_URL`. المتغير غير السري `HEALTH_URL` هو أصل الموقع.

## المراقبة

- يفحص مراقب خارجي `/api/health` كل 5 دقائق وينبه بعد فشلين؛ الاستجابة لا تعرض أسرارًا.
- يضبط `MONITORING_ALERT_WEBHOOK_URL` لاستقبال فشل notification outbox بحمولة رموز فقط بلا PII.
- تنبيهات إضافية: امتلاء قاعدة/Storage، اتصالات قاعدة البيانات، أخطاء 5xx، عمر أقدم outbox،
  وفشل cron أو النسخ الاحتياطي.
- تُخفى قيم headers والجلسات والبريد والهاتف من السجلات، ويكون الاحتفاظ بالسجلات 30 يومًا.

النشر الفعلي وإنشاء البيئتين والتنبيه الخارجي مؤجل حتى يوفر المالك حسابات وأسرار الاستضافة؛
إضافة workflow وحدها لا تغلق P11-T05.
