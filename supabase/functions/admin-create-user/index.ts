// Supabase Edge Function: admin-create-user
// Lets an authenticated Admin create or delete login accounts from inside the app.
// The service_role key never leaves the server — it is injected here automatically.
//
// Deploy (one time):
//   npm i -g supabase
//   supabase login
//   supabase link --project-ref <your-project-ref>
//   supabase functions deploy admin-create-user
//
// Body to create: { name, email, password, role }
// Body to delete: { action: "delete", id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // Identify the caller from their JWT and confirm they are an Admin.
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Not signed in' }, 401)
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData.user) return json({ error: 'Invalid session' }, 401)

    const { data: profile } = await admin.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
    if (profile?.role !== 'Admin') return json({ error: 'Admins only' }, 403)

    const body = await req.json().catch(() => ({}))

    if (body.action === 'delete') {
      if (body.id === userData.user.id) return json({ error: 'You cannot delete your own account' }, 400)
      const { error } = await admin.auth.admin.deleteUser(body.id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    const { name, email, password, role } = body
    if (!email || !password) return json({ error: 'Email and password are required' }, 400)
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name ?? '', role: role ?? 'Operator' },
    })
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true, id: data.user?.id })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
