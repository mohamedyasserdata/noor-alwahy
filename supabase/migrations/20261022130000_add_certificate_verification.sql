create table private.certificate_verification_limits (
  requester_hash text not null,
  window_start timestamptz not null,
  attempts integer not null default 1 check (attempts between 1 and 1000),
  primary key(requester_hash,window_start)
);
revoke all on private.certificate_verification_limits from public,anon,authenticated,service_role;

create or replace function public.verify_certificate(p_code text)
returns table(valid boolean,status text,student_name text,certificate_kind text,issued_on date,serial_no text)
language plpgsql security definer set search_path = '' as $$
declare headers jsonb; requester text; requester_digest text; bucket timestamptz; current_attempts integer; row record;
begin
  if p_code is null or char_length(p_code) not between 32 and 128 or p_code !~ '^[a-zA-Z0-9_-]+$' then
    return query select false,'not_found'::text,null::text,null::text,null::date,null::text;
    return;
  end if;
  begin headers := coalesce(current_setting('request.headers',true),'{}')::jsonb; exception when others then headers := '{}'::jsonb; end;
  requester := coalesce(headers->>'cf-connecting-ip',headers->>'x-real-ip',split_part(coalesce(headers->>'x-forwarded-for','unknown'),',',1),'unknown')||':'||coalesce(headers->>'user-agent','unknown');
  requester_digest := encode(digest(requester,'sha256'),'hex');
  bucket := date_bin(interval '10 minutes',clock_timestamp(),timestamptz '2020-01-01 00:00:00+00');
  insert into private.certificate_verification_limits(requester_hash,window_start,attempts) values(requester_digest,bucket,1)
  on conflict(requester_hash,window_start) do update set attempts=private.certificate_verification_limits.attempts+1 returning attempts into current_attempts;
  if current_attempts > 15 then raise exception using errcode='P0001',message='certificate_verification_rate_limited'; end if;
  select certificate.serial_no,certificate.kind,certificate.issued_at,certificate.revoked_at,student.full_name into row
  from public.certificates as certificate join public.students as student on student.id=certificate.student_id
  where certificate.verify_code=p_code;
  if row.serial_no is null then return query select false,'not_found'::text,null::text,null::text,null::date,null::text; return; end if;
  return query select row.revoked_at is null,case when row.revoked_at is null then 'valid' else 'revoked' end,
    split_part(row.full_name,' ',1)||case when position(' ' in row.full_name)>0 then ' '||left(regexp_replace(row.full_name,'^.*\s','','g'),1)||'.' else '' end,
    row.kind::text,row.issued_at::date,row.serial_no::text;
end;
$$;
revoke execute on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon,authenticated,service_role;

create or replace function public.revoke_certificate(p_certificate uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception using errcode='42501',message='admin_mfa_required'; end if;
  if char_length(btrim(p_reason)) not between 5 and 500 then raise exception using errcode='22023',message='certificate_revoke_reason_invalid'; end if;
  update public.certificates set revoked_at=now(),revoked_by=(select auth.uid()),revoke_reason=btrim(p_reason)
  where id=p_certificate and revoked_at is null;
  if not found then raise exception using errcode='P0001',message='certificate_not_revocable'; end if;
end;
$$;
revoke execute on function public.revoke_certificate(uuid,text) from public,anon;
grant execute on function public.revoke_certificate(uuid,text) to authenticated,service_role;

create index certificate_verification_limits_window_idx on private.certificate_verification_limits(window_start);
