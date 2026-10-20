import fs from 'node:fs';

const env = {};
for (const raw of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq > 0) {
    env[line.slice(0, eq)] = line.slice(eq + 1);
  }
}

const projectUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL || 'admin@quizim.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';

if (!projectUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables in .env.');
}

const serviceHeaders = {
  'Content-Type': 'application/json',
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
};

async function ensureAdminUser() {
  const createRes = await fetch(`${projectUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: 'admin' },
    }),
  });

  const createText = await createRes.text();
  if (createRes.status === 422) {
    const existingRes = await fetch(`${projectUrl}/auth/v1/admin/users?email=eq.${encodeURIComponent(adminEmail)}`, {
      method: 'GET',
      headers: serviceHeaders,
    });
    const existingPayload = await existingRes.json();
    if (!existingPayload || !Array.isArray(existingPayload) || !existingPayload.length) {
      throw new Error(`User creation conflict: ${createText}`);
    }
    return existingPayload[0];
  }

  if (!createRes.ok) {
    throw new Error(`Failed to create auth user (${createRes.status}): ${createText}`);
  }

  const user = JSON.parse(createText);
  if (!user?.id) {
    throw new Error(`No user id returned: ${createText}`);
  }

  return user;
}

async function upsertAdminProfile(userId) {
  const profileRes = await fetch(`${projectUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: userId,
      full_name: 'Administrator',
      role: 'admin',
    }),
  });

  const profileText = await profileRes.text();
  if (!profileRes.ok && profileRes.status !== 201 && profileRes.status !== 204) {
    throw new Error(`Profile insert failed (${profileRes.status}): ${profileText}`);
  }
}

async function verifyAdminLogin() {
  const signInRes = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  const signInText = await signInRes.text();
  if (!signInRes.ok) {
    throw new Error(`Admin login verification failed (${signInRes.status}): ${signInText}`);
  }
}

const user = await ensureAdminUser();
await upsertAdminProfile(user.id);
await verifyAdminLogin();

console.log(JSON.stringify({
  status: 'admin-created',
  email: adminEmail,
  password: adminPassword,
  user_id: user.id,
  login_verified: true,
}, null, 2));
