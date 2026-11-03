alter table public.session_participants
add column id uuid default gen_random_uuid();

update public.session_participants
set id = gen_random_uuid()
where id is null;

alter table public.session_participants
alter column id set not null;

alter table public.session_participants
drop constraint session_participants_pkey;

alter table public.session_participants
add constraint session_participants_pkey primary key (id);

alter table public.session_participants
add constraint session_participants_session_student_key unique (session_id, student_id);
