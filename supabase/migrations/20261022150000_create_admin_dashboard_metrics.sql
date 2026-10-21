create view public.admin_attendance_daily with (security_invoker=true,security_barrier=true) as
select session.scheduled_at::date as day,session.teacher_id,
  count(*) filter(where attendance.status not in ('cancelled_teacher','cancelled_admin','teacher_absent'))::integer as eligible,
  count(*) filter(where attendance.status in ('present','late'))::integer as attended
from public.sessions as session join public.attendance as attendance on attendance.session_id=session.id
group by session.scheduled_at::date,session.teacher_id;

create view public.admin_finance_monthly with (security_invoker=true,security_barrier=true) as
select month,currency,sum(revenue)::numeric(14,2) as revenue,sum(expense)::numeric(14,2) as expense
from (
  select date_trunc('month',payment.confirmed_at)::date as month,payment.currency,
    sum(case when payment.kind='refund' then -payment.amount else payment.amount end) as revenue,0::numeric as expense
  from public.payments as payment where payment.status='confirmed' group by 1,2
  union all
  select date_trunc('month',expense.incurred_on)::date,expense.currency,0::numeric,sum(expense.amount)
  from public.expenses as expense where expense.status='recorded' group by 1,2
) as ledger group by month,currency;

create view public.admin_student_distribution with (security_invoker=true,security_barrier=true) as
select student.country_code,student.timezone,student.level_id,count(*)::integer as students
from public.students as student where student.status='active'
group by student.country_code,student.timezone,student.level_id;

create view public.admin_teacher_commitment with (security_invoker=true,security_barrier=true) as
select teacher.id as teacher_id,profile.full_name,
  coalesce(sum(daily.attended),0)::integer as attended,coalesce(sum(daily.eligible),0)::integer as eligible,
  case when coalesce(sum(daily.eligible),0)=0 then null else round(sum(daily.attended)::numeric/sum(daily.eligible)*100,2) end as commitment_pct
from public.teachers as teacher join public.profiles as profile on profile.id=teacher.profile_id
left join public.admin_attendance_daily as daily on daily.teacher_id=teacher.id
where teacher.status='active' group by teacher.id,profile.full_name;

revoke all on public.admin_attendance_daily,public.admin_finance_monthly,public.admin_student_distribution,public.admin_teacher_commitment from public,anon,authenticated;
grant select on public.admin_attendance_daily,public.admin_finance_monthly,public.admin_student_distribution,public.admin_teacher_commitment to service_role;

create or replace function public.get_admin_dashboard(p_from date default current_date-interval '90 days',p_to date default current_date,p_country text default null,p_currency text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception using errcode='42501',message='admin_mfa_required'; end if;
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>730 then raise exception using errcode='22023',message='dashboard_period_invalid'; end if;
  if p_country is not null and p_country !~ '^[A-Z]{2}$' then raise exception using errcode='22023',message='dashboard_country_invalid'; end if;
  if p_currency is not null and p_currency !~ '^[A-Z]{3}$' then raise exception using errcode='22023',message='dashboard_currency_invalid'; end if;
  select jsonb_build_object(
    'totals',jsonb_build_object(
      'students',(select count(*) from public.students s where s.status='active' and (p_country is null or s.country_code=p_country)),
      'teachers',(select count(*) from public.teachers t where t.status='active'),
      'active_subscriptions',(select count(*) from public.subscriptions sub join public.students s on s.id=sub.student_id where sub.status='active' and (p_country is null or s.country_code=p_country)),
      'new_applications',(select count(*) from public.applications a where a.created_at::date between p_from and p_to and (p_country is null or a.country_code=p_country)),
      'today_attendance',(select case when sum(d.eligible)=0 then null else round(sum(d.attended)::numeric/sum(d.eligible)*100,2) end from public.admin_attendance_daily d where d.day=current_date)
    ),
    'conversion_rate',(select case when count(*)=0 then null else round(count(*) filter(where a.status='accepted' and a.converted_student_id is not null)::numeric/count(*)*100,2) end from public.applications a where a.created_at::date between p_from and p_to and (p_country is null or a.country_code=p_country)),
    'churn_rate',(select case when count(*) filter(where sub.start_date<date_trunc('month',p_to)::date and sub.current_period_end>=date_trunc('month',p_to)::date)=0 then null else round(count(*) filter(where sub.status in ('expired','cancelled') and sub.updated_at::date between date_trunc('month',p_to)::date and p_to and not exists(select 1 from public.subscriptions renewal where renewal.student_id=sub.student_id and renewal.start_date between sub.current_period_end and sub.current_period_end+14))::numeric/count(*) filter(where sub.start_date<date_trunc('month',p_to)::date and sub.current_period_end>=date_trunc('month',p_to)::date)*100,2) end from public.subscriptions sub join public.students s on s.id=sub.student_id where (p_country is null or s.country_code=p_country)),
    'mrr',(select coalesce(jsonb_agg(jsonb_build_object('currency',x.currency,'amount',x.amount) order by x.currency),'[]'::jsonb) from (select sub.price_currency as currency,round(sum(sub.price_amount/case package.billing_period when 'yearly' then 12 when 'quarterly' then 3 else 1 end),2) as amount from public.subscriptions sub join public.packages package on package.id=sub.package_id join public.students s on s.id=sub.student_id where sub.status='active' and sub.price_currency is not null and (p_country is null or s.country_code=p_country) and (p_currency is null or sub.price_currency=p_currency) group by sub.price_currency) x),
    'overdue',(select coalesce(jsonb_agg(jsonb_build_object('currency',x.currency,'amount',x.amount) order by x.currency),'[]'::jsonb) from (select invoice.currency,sum(invoice.total-coalesce(paid.amount,0)) as amount from public.invoices invoice join public.students s on s.id=invoice.student_id left join lateral(select sum(case when payment.kind='refund' then -payment.amount else payment.amount end) amount from public.payments payment where payment.invoice_id=invoice.id and payment.status='confirmed') paid on true where invoice.status='overdue' and (p_country is null or s.country_code=p_country) and (p_currency is null or invoice.currency=p_currency) group by invoice.currency) x),
    'attendance',(select coalesce(jsonb_agg(jsonb_build_object('day',x.day,'rate',x.rate) order by x.day),'[]'::jsonb) from (select d.day,case when sum(d.eligible)=0 then null else round(sum(d.attended)::numeric/sum(d.eligible)*100,2) end rate from public.admin_attendance_daily d where d.day between p_from and p_to group by d.day) x),
    'finance',(select coalesce(jsonb_agg(jsonb_build_object('month',f.month,'currency',f.currency,'revenue',f.revenue,'expense',f.expense) order by f.month,f.currency),'[]'::jsonb) from public.admin_finance_monthly f where f.month between date_trunc('month',p_from)::date and p_to and (p_currency is null or f.currency=p_currency)),
    'levels',(select coalesce(jsonb_agg(jsonb_build_object('name_ar',x.name_ar,'name_en',x.name_en,'students',x.students) order by x.students desc),'[]'::jsonb) from (select coalesce(level.name_ar,'غير محدد') name_ar,coalesce(level.name_en,'Unassigned') name_en,count(*) students from public.students s left join public.levels level on level.id=s.level_id where s.status='active' and (p_country is null or s.country_code=p_country) group by level.name_ar,level.name_en) x),
    'teachers',(select coalesce(jsonb_agg(jsonb_build_object('id',x.teacher_id,'name',x.full_name,'rate',x.commitment_pct,'eligible',x.eligible) order by x.commitment_pct desc nulls last),'[]'::jsonb) from (select c.* from public.admin_teacher_commitment c limit 10) x),
    'packages',(select coalesce(jsonb_agg(jsonb_build_object('name_ar',x.name_ar,'name_en',x.name_en,'subscriptions',x.subscriptions) order by x.subscriptions desc),'[]'::jsonb) from (select package.name_ar,package.name_en,count(*) subscriptions from public.subscriptions sub join public.packages package on package.id=sub.package_id join public.students s on s.id=sub.student_id where sub.created_at::date between p_from and p_to and (p_country is null or s.country_code=p_country) group by package.id order by count(*) desc limit 8) x),
    'countries',(select coalesce(jsonb_agg(jsonb_build_object('country',x.country_code,'students',x.students) order by x.students desc),'[]'::jsonb) from (select s.country_code,count(*) students from public.students s where s.status='active' group by s.country_code) x),
    'currencies',(select coalesce(jsonb_agg(distinct invoice.currency),'[]'::jsonb) from public.invoices invoice),
    'recent_activity',(select coalesce(jsonb_agg(jsonb_build_object('action',x.action,'table',x.table_name,'record',x.record_id,'at',x.created_at) order by x.created_at desc),'[]'::jsonb) from (select log.action,log.table_name,log.record_id,log.created_at from public.audit_logs log order by log.created_at desc limit 12) x)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.get_admin_dashboard(date,date,text,text) from public,anon;
grant execute on function public.get_admin_dashboard(date,date,text,text) to authenticated,service_role;
