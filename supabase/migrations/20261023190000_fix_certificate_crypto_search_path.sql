-- Certificate RPCs use pgcrypto primitives while retaining a fixed, trusted search path.
alter function public.issue_certificate(uuid, uuid, text, text, text)
  set search_path = pg_catalog, extensions;

alter function public.verify_certificate(text)
  set search_path = pg_catalog, extensions;
