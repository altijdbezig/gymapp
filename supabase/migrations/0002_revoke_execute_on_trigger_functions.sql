-- Follow-up on the security advisor after migration 0001.
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, and Supabase
-- exposes the public schema over REST. That made handle_new_user() callable as
-- /rest/v1/rpc/handle_new_user by anyone with the publishable key. The call
-- would fail (a trigger function cannot be invoked directly), but a
-- SECURITY DEFINER function runs with the owner's rights, so it should never
-- be reachable from outside in the first place.
--
-- Triggers do not need these grants: Postgres runs the trigger function itself,
-- not the role issuing the insert.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
