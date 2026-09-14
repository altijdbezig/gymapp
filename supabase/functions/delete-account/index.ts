/**
 * delete-account — the GDPR article 17 "right to erasure" endpoint.
 *
 * Deleting a row from auth.users needs the service role key, which may never be
 * in the app bundle. So the app calls this with its own session, the function
 * checks who that is, and then deletes exactly that user.
 *
 * Every table in the schema has `references auth.users (id) on delete cascade`,
 * so removing the auth row takes the profile, the food log, the sessions, the
 * recipes and the medication with it. There is nothing left behind, which is
 * the point of the article.
 *
 * Deploy: supabase functions deploy delete-account
 * The SUPABASE_SERVICE_ROLE_KEY secret is provided by the platform; you do not
 * set it yourself.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Niet ingelogd.' }, 401);
    }

    // First client: the caller's own token. Its only job is to answer "who is
    // asking?" -- it has no more rights than the app itself.
    const asUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await asUser.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: 'Niet ingelogd.' }, 401);
    }

    // Second client: the service role, used for exactly one call, on exactly
    // the id the first client established. The id is never taken from the
    // request body, so nobody can ask this function to delete somebody else.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
    if (deleteError) {
      console.error('delete-account failed', deleteError);
      return json({ error: 'Je account kon niet worden verwijderd.' }, 500);
    }

    return json({ deleted: true });
  } catch (error) {
    console.error('delete-account failed', error);
    return json({ error: 'Er ging iets mis bij het verwijderen.' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
