update public.packages
set audience = 'all',
    teacher_gender = null
where audience is distinct from 'all'
   or teacher_gender is not null;
