-- The review state is safe portal metadata; the meeting URL itself remains behind
-- the existing security-definer functions so students cannot read an unapproved link.
grant select (zoom_review_status) on public.sessions to authenticated;
