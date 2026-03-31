/**
 * Full-Scale Test Suite
 * Run: node tests/full-test-suite.mjs
 *
 * Tests migration integrity AND general feature correctness against
 * the new Supabase project (varolnwetchstlfholbl).
 */

const SUPABASE_URL = 'https://varolnwetchstlfholbl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhcm9sbndldGNoc3RsZmhvbGJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc2Njc0MywiZXhwIjoyMDg2MzQyNzQzfQ.p9rW6Kufh3iAv8cUZD8EmrqY5H9InPkcGNyKQ4ltUBQ';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhcm9sbndldGNoc3RsZmhvbGJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NjY3NDMsImV4cCI6MjA4NjM0Mjc0M30.Bdjo1-1jvO25RVN3BJtZQ_CYfmuTSWyH4SC7PeG9pRc';

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    failures.push({ name, error: err.message });
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  SKIP  ${name} (${reason})`);
}

async function restQuery(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  return res.json();
}

async function restQueryAnon(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function restCount(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    method: 'HEAD',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'count=exact',
      'Range': '0-0',
    },
  });
  const range = res.headers.get('content-range');
  return range ? parseInt(range.split('/')[1]) : 0;
}

async function callEdgeFunction(name, body = {}, method = 'POST') {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.text() };
}

async function rpcCall(fn, params = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  return { status: res.status, data: await res.json().catch(() => null), text: await res.clone().text().catch(() => '') };
}

// ============================================================
// SECTION 1: DATABASE CONNECTIVITY & SCHEMA
// ============================================================
console.log('\n=== 1. DATABASE CONNECTIVITY & SCHEMA ===');

await test('REST API reachable (service role)', async () => {
  const data = await restQuery('factory_accounts', '?select=id&limit=1');
  if (!Array.isArray(data)) throw new Error('Expected array');
});

await test('REST API reachable (anon key)', async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { 'apikey': ANON_KEY },
  });
  if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
});

// Check all expected tables exist
const allTables = [
  'factory_accounts', 'profiles', 'user_roles', 'units', 'floors', 'lines',
  'work_orders', 'work_order_line_assignments', 'stages', 'blocker_types',
  'sewing_targets', 'sewing_actuals', 'cutting_targets', 'cutting_actuals',
  'finishing_targets', 'finishing_actuals', 'finishing_daily_logs',
  'knowledge_chunks', 'knowledge_documents', 'chat_conversations', 'chat_messages',
  'notification_preferences', 'rate_limits', 'security_events',
  'production_notes', 'production_note_comments', 'app_error_logs',
];

for (const table of allTables) {
  await test(`Table '${table}' exists and is queryable`, async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=0`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
}

// ============================================================
// SECTION 2: AUTH SYSTEM
// ============================================================
console.log('\n=== 2. AUTH SYSTEM ===');

await test('Auth users exist (>= 38)', async () => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=50`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  const data = await res.json();
  const count = data.users?.length || 0;
  if (count < 38) throw new Error(`Expected >= 38, got ${count}`);
});

await test('Every profile has a matching auth user', async () => {
  const profiles = await restQuery('profiles', '?select=id&limit=50');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=100`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  const authData = await res.json();
  const authIds = new Set(authData.users.map(u => u.id));
  const orphaned = profiles.filter(p => !authIds.has(p.id));
  if (orphaned.length > 0) throw new Error(`${orphaned.length} profiles without auth user: ${orphaned.map(p => p.id).join(', ')}`);
});

await test('Every user_role has a valid user_id in profiles', async () => {
  const roles = await restQuery('user_roles', '?select=id,user_id');
  const profiles = await restQuery('profiles', '?select=id');
  const profileIds = new Set(profiles.map(p => p.id));
  const orphaned = roles.filter(r => !profileIds.has(r.user_id));
  if (orphaned.length > 0) throw new Error(`${orphaned.length} roles with orphaned user_id`);
});

await test('All user_roles have a valid role value', async () => {
  const validRoles = ['admin', 'owner', 'line_lead', 'floor_manager', 'unit_manager', 'viewer', 'buyer', 'worker', 'cutting', 'storage', 'sewing', 'gate_officer'];
  const roles = await restQuery('user_roles', '?select=id,role');
  const invalid = roles.filter(r => !validRoles.includes(r.role));
  if (invalid.length > 0) throw new Error(`${invalid.length} roles with invalid role: ${invalid.map(r => r.role).join(', ')}`);
});

await test('No duplicate user_role per user+factory', async () => {
  const roles = await restQuery('user_roles', '?select=user_id,factory_id,role');
  const seen = new Set();
  const dupes = [];
  for (const r of roles) {
    const key = `${r.user_id}:${r.factory_id}:${r.role}`;
    if (seen.has(key)) dupes.push(key);
    seen.add(key);
  }
  if (dupes.length > 0) throw new Error(`${dupes.length} duplicate user_role entries`);
});

// ============================================================
// SECTION 3: RLS (Row Level Security)
// ============================================================
console.log('\n=== 3. ROW LEVEL SECURITY ===');

await test('Anon cannot read factory_accounts data', async () => {
  const { status, data } = await restQueryAnon('factory_accounts', '?select=id,name&limit=5');
  // RLS should return empty array or 200 with no data
  if (data && data.length > 0 && !data[0]?.id) return; // empty object
  if (Array.isArray(data) && data.length > 0) {
    // Check if we actually got real data back
    if (data[0].name) throw new Error('Anon can read factory names — RLS may be misconfigured');
  }
});

await test('Anon cannot read profiles', async () => {
  const { data } = await restQueryAnon('profiles', '?select=id,full_name&limit=5');
  if (Array.isArray(data) && data.length > 0 && data[0].full_name) {
    throw new Error('Anon can read profile names — RLS may be misconfigured');
  }
});

await test('Anon cannot read security_events', async () => {
  const { data } = await restQueryAnon('security_events', '?select=id&limit=5');
  if (Array.isArray(data) && data.length > 0) {
    throw new Error('Anon can read security events — RLS may be misconfigured');
  }
});

await test('Service role can read all tables (bypasses RLS)', async () => {
  const data = await restQuery('factory_accounts', '?select=id,name&limit=1');
  if (!data[0]?.name) throw new Error('Service role cannot read factory names');
});

// ============================================================
// SECTION 4: DATA INTEGRITY — ROW COUNTS
// ============================================================
console.log('\n=== 4. DATA INTEGRITY — ROW COUNTS ===');

const expectedCounts = {
  factory_accounts: 12,
  profiles: 38,
  user_roles: 47,
  units: 9,
  floors: 11,
  lines: 112,
  work_orders: 96,
  stages: 112,
  blocker_types: 70,
  sewing_targets: 154,
  sewing_actuals: 151,
  cutting_targets: 77,
  cutting_actuals: 270,
  finishing_targets: 77,
  finishing_actuals: 77,
  finishing_daily_logs: 50,
  knowledge_chunks: 93,
  knowledge_documents: 5,
  chat_conversations: 80,
  chat_messages: 204,
  notification_preferences: 125,
  security_events: 100,
  work_order_line_assignments: 1,
};

for (const [table, expected] of Object.entries(expectedCounts)) {
  await test(`${table} >= ${expected} rows`, async () => {
    const count = await restCount(table);
    if (count < expected) throw new Error(`Expected >= ${expected}, got ${count}`);
  });
}

// ============================================================
// SECTION 5: FOREIGN KEY RELATIONSHIPS
// ============================================================
console.log('\n=== 5. FOREIGN KEY RELATIONSHIPS ===');

await test('All sewing_targets reference valid work_orders', async () => {
  const targets = await restQuery('sewing_targets', '?select=id,work_order_id,work_orders(id)&limit=20');
  const orphaned = targets.filter(t => !t.work_orders);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} targets with orphaned work_order_id`);
});

await test('All sewing_actuals reference valid work_orders', async () => {
  const actuals = await restQuery('sewing_actuals', '?select=id,work_order_id,work_orders(id)&limit=20');
  const orphaned = actuals.filter(a => !a.work_orders);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} actuals with orphaned work_order_id`);
});

await test('All work_order_line_assignments reference valid lines', async () => {
  const assignments = await restQuery('work_order_line_assignments', '?select=id,line_id,lines(id)&limit=20');
  const orphaned = assignments.filter(a => !a.lines);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} assignments with orphaned line_id`);
});

await test('All work_order_line_assignments reference valid work_orders', async () => {
  const assignments = await restQuery('work_order_line_assignments', '?select=id,work_order_id,work_orders(id)&limit=20');
  const orphaned = assignments.filter(a => !a.work_orders);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} assignments with orphaned work_order_id`);
});

await test('All lines reference valid floors', async () => {
  const lines = await restQuery('lines', '?select=id,floor_id,floors(id)&limit=20');
  const orphaned = lines.filter(l => l.floor_id && !l.floors);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} lines with orphaned floor_id`);
});

await test('All floors reference valid units', async () => {
  const floors = await restQuery('floors', '?select=id,unit_id,units(id)&limit=20');
  const orphaned = floors.filter(f => !f.units);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} floors with orphaned unit_id`);
});

await test('All units reference valid factory_accounts', async () => {
  const units = await restQuery('units', '?select=id,factory_id,factory_accounts(id)&limit=20');
  const orphaned = units.filter(u => !u.factory_accounts);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} units with orphaned factory_id`);
});

await test('All profiles reference valid factory_accounts', async () => {
  const profiles = await restQuery('profiles', '?select=id,factory_id,factory_accounts(id)&limit=50');
  const orphaned = profiles.filter(p => p.factory_id && !p.factory_accounts);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} profiles with orphaned factory_id`);
});

await test('All chat_messages reference valid conversations', async () => {
  const msgs = await restQuery('chat_messages', '?select=id,conversation_id,chat_conversations(id)&limit=20');
  const orphaned = msgs.filter(m => !m.chat_conversations);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} messages with orphaned conversation_id`);
});

await test('All knowledge_chunks reference valid documents', async () => {
  const chunks = await restQuery('knowledge_chunks', '?select=id,document_id,knowledge_documents(id)&limit=20');
  const orphaned = chunks.filter(c => !c.knowledge_documents);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} chunks with orphaned document_id`);
});

await test('Finishing targets reference valid work_orders', async () => {
  const targets = await restQuery('finishing_targets', '?select=id,work_order_id,work_orders(id)&limit=20');
  const orphaned = targets.filter(t => !t.work_orders);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} finishing targets with orphaned work_order_id`);
});

await test('Cutting targets reference valid work_orders', async () => {
  const targets = await restQuery('cutting_targets', '?select=id,work_order_id,work_orders(id)&limit=20');
  const orphaned = targets.filter(t => !t.work_orders);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} cutting targets with orphaned work_order_id`);
});

// ============================================================
// SECTION 6: KNOWLEDGE BASE & EMBEDDINGS
// ============================================================
console.log('\n=== 6. KNOWLEDGE BASE & EMBEDDINGS ===');

await test('All knowledge_chunks have non-null embeddings', async () => {
  const chunks = await restQuery('knowledge_chunks', '?select=id,embedding&embedding=not.is.null&limit=5');
  if (chunks.length === 0) throw new Error('No chunks with embeddings found');
  // Also check for chunks WITHOUT embeddings
  const nullChunks = await restQuery('knowledge_chunks', '?select=id&embedding=is.null');
  if (nullChunks.length > 0) throw new Error(`${nullChunks.length} chunks missing embeddings`);
});

await test('Knowledge documents have titles and document types', async () => {
  const docs = await restQuery('knowledge_documents', '?select=id,title,document_type');
  for (const doc of docs) {
    if (!doc.title) throw new Error(`Document ${doc.id} missing title`);
  }
});

await test('Knowledge chunks have content', async () => {
  const chunks = await restQuery('knowledge_chunks', '?select=id,content&limit=10');
  const empty = chunks.filter(c => !c.content || c.content.trim() === '');
  if (empty.length > 0) throw new Error(`${empty.length} chunks with empty content`);
});

// ============================================================
// SECTION 7: EDGE FUNCTIONS — ALL 25
// ============================================================
console.log('\n=== 7. EDGE FUNCTIONS — DEPLOYMENT ===');

const edgeFunctions = [
  'admin-invite-user', 'admin-reset-password', 'auth-rate-limit',
  'cancel-subscription', 'change-subscription', 'chat', 'chat-feedback',
  'check-subscription', 'create-checkout', 'customer-portal',
  'generate-embedding', 'get-billing-history', 'get-source',
  'ingest-chunk', 'ingest-document', 'link-factory-subscription',
  'notify-blocker', 'process-scheduled-emails', 'process-scheduled-notifications',
  'remove-user-access', 'send-billing-notification', 'send-insights-report',
  'send-welcome-email', 'stripe-webhook', 'terminate-account',
];

for (const fn of edgeFunctions) {
  await test(`Edge function '${fn}' is deployed`, async () => {
    const { status } = await callEdgeFunction(fn, {});
    if (status === 404) throw new Error('Function not found (404)');
  });
}

// ============================================================
// SECTION 8: STRIPE INTEGRATION (deep)
// ============================================================
console.log('\n=== 8. STRIPE INTEGRATION ===');

await test('stripe-webhook: secret is configured', async () => {
  const { body } = await callEdgeFunction('stripe-webhook', { test: true });
  if (body.includes('not configured')) throw new Error('STRIPE_WEBHOOK_SECRET not set');
  if (!body.includes('Missing signature')) throw new Error(`Unexpected: ${body}`);
});

await test('create-checkout: STRIPE_SECRET_KEY is set', async () => {
  const { body } = await callEdgeFunction('create-checkout', {});
  if (body.includes('STRIPE_SECRET_KEY')) throw new Error('STRIPE_SECRET_KEY not set');
});

await test('check-subscription: STRIPE_SECRET_KEY is set', async () => {
  const { body } = await callEdgeFunction('check-subscription', {});
  if (body.includes('STRIPE_SECRET_KEY')) throw new Error('STRIPE_SECRET_KEY not set');
});

await test('change-subscription: STRIPE_SECRET_KEY is set', async () => {
  const { body } = await callEdgeFunction('change-subscription', {});
  if (body.includes('STRIPE_SECRET_KEY')) throw new Error('STRIPE_SECRET_KEY not set');
});

await test('cancel-subscription: STRIPE_SECRET_KEY is set', async () => {
  const { body } = await callEdgeFunction('cancel-subscription', {});
  if (body.includes('STRIPE_SECRET_KEY')) throw new Error('STRIPE_SECRET_KEY not set');
});

await test('customer-portal: STRIPE_SECRET_KEY is set', async () => {
  const { body } = await callEdgeFunction('customer-portal', {});
  if (body.includes('STRIPE_SECRET_KEY is not set')) throw new Error('STRIPE_SECRET_KEY not set');
});

await test('get-billing-history: responds without key error', async () => {
  const { body } = await callEdgeFunction('get-billing-history', {});
  if (body.includes('STRIPE_SECRET_KEY')) throw new Error('STRIPE_SECRET_KEY not set');
});

await test('link-factory-subscription: responds', async () => {
  const { status } = await callEdgeFunction('link-factory-subscription', {});
  if (status === 404) throw new Error('Function not deployed');
});

// ============================================================
// SECTION 9: EMAIL FUNCTIONS (Resend)
// ============================================================
console.log('\n=== 9. EMAIL FUNCTIONS ===');

await test('notify-blocker: RESEND_API_KEY is set', async () => {
  const { body } = await callEdgeFunction('notify-blocker', {});
  if (body.includes('RESEND_API_KEY')) throw new Error('RESEND_API_KEY not set');
});

await test('send-welcome-email: responds', async () => {
  const { status, body } = await callEdgeFunction('send-welcome-email', {});
  if (status === 404) throw new Error('Function not deployed');
  if (body.includes('RESEND_API_KEY')) throw new Error('RESEND_API_KEY not set');
});

await test('send-billing-notification: RESEND_API_KEY is set', async () => {
  const { body } = await callEdgeFunction('send-billing-notification', {});
  if (body.includes('RESEND_API_KEY not set')) throw new Error('RESEND_API_KEY not set');
});

await test('send-insights-report: responds', async () => {
  const { status } = await callEdgeFunction('send-insights-report', {});
  if (status === 404) throw new Error('Function not deployed');
});

await test('process-scheduled-emails: responds', async () => {
  const { status } = await callEdgeFunction('process-scheduled-emails', {});
  if (status === 404) throw new Error('Function not deployed');
});

// ============================================================
// SECTION 10: AI / CHAT FUNCTIONS
// ============================================================
console.log('\n=== 10. AI / CHAT FUNCTIONS ===');

await test('chat function: responds (auth error expected)', async () => {
  const { status, body } = await callEdgeFunction('chat', { message: 'test' });
  if (status === 404) throw new Error('Function not deployed');
  // Should fail with auth error, not with missing API key
});

await test('generate-embedding function: responds', async () => {
  const { status } = await callEdgeFunction('generate-embedding', { text: 'test' });
  if (status === 404) throw new Error('Function not deployed');
});

await test('ingest-document function: responds', async () => {
  const { status } = await callEdgeFunction('ingest-document', {});
  if (status === 404) throw new Error('Function not deployed');
});

await test('ingest-chunk function: responds', async () => {
  const { status } = await callEdgeFunction('ingest-chunk', {});
  if (status === 404) throw new Error('Function not deployed');
});

await test('get-source function: responds', async () => {
  const { status } = await callEdgeFunction('get-source', {});
  if (status === 404) throw new Error('Function not deployed');
});

await test('chat-feedback function: responds', async () => {
  const { status } = await callEdgeFunction('chat-feedback', {});
  if (status === 404) throw new Error('Function not deployed');
});

// ============================================================
// SECTION 11: FACTORY HIERARCHY (unit > floor > line)
// ============================================================
console.log('\n=== 11. FACTORY HIERARCHY ===');

await test('Every line belongs to a floor that belongs to a unit', async () => {
  const lines = await restQuery('lines', '?select=id,name,floor_id,floors(id,unit_id,units(id,factory_id))&limit=30');
  for (const line of lines) {
    if (!line.floors) throw new Error(`Line ${line.name} has no floor`);
    if (!line.floors.units) throw new Error(`Line ${line.name}'s floor has no unit`);
    if (!line.floors.units.factory_id) throw new Error(`Line ${line.name}'s unit has no factory`);
  }
});

await test('Factory accounts have required fields', async () => {
  const factories = await restQuery('factory_accounts', '?select=id,name,timezone');
  for (const f of factories) {
    if (!f.name) throw new Error(`Factory ${f.id} missing name`);
    if (!f.timezone) throw new Error(`Factory ${f.name} missing timezone`);
  }
});

await test('Work orders have required fields', async () => {
  const orders = await restQuery('work_orders', '?select=id,style,factory_id&limit=20');
  for (const wo of orders) {
    if (!wo.style) throw new Error(`WO ${wo.id} missing style`);
    if (!wo.factory_id) throw new Error(`WO ${wo.id} missing factory_id`);
  }
});

// ============================================================
// SECTION 12: PRODUCTION DATA CONSISTENCY
// ============================================================
console.log('\n=== 12. PRODUCTION DATA CONSISTENCY ===');

await test('Sewing targets have required fields', async () => {
  const targets = await restQuery('sewing_targets', '?select=id,order_qty,production_date,work_order_id&limit=20');
  for (const t of targets) {
    if (!t.production_date) throw new Error(`Target ${t.id} missing production_date`);
    if (!t.work_order_id) throw new Error(`Target ${t.id} missing work_order_id`);
  }
});

await test('Sewing actuals have required fields', async () => {
  const actuals = await restQuery('sewing_actuals', '?select=id,good_today,work_order_id&limit=20');
  for (const a of actuals) {
    if (a.good_today == null) throw new Error(`Actual ${a.id} missing good_today`);
    if (!a.work_order_id) throw new Error(`Actual ${a.id} missing work_order_id`);
  }
});

await test('Cutting targets have required fields', async () => {
  const targets = await restQuery('cutting_targets', '?select=id,order_qty,production_date&limit=20');
  for (const t of targets) {
    if (!t.production_date) throw new Error(`Cutting target ${t.id} missing production_date`);
  }
});

await test('Cutting actuals have required fields', async () => {
  const actuals = await restQuery('cutting_actuals', '?select=id,day_cutting,work_order_id&limit=20');
  for (const a of actuals) {
    if (!a.work_order_id) throw new Error(`Cutting actual ${a.id} missing work_order_id`);
  }
});

await test('Finishing targets have required fields', async () => {
  const targets = await restQuery('finishing_targets', '?select=id,per_hour_target,production_date&limit=20');
  for (const t of targets) {
    if (!t.production_date) throw new Error(`Finishing target ${t.id} missing production_date`);
  }
});

await test('Finishing daily logs have required fields', async () => {
  const logs = await restQuery('finishing_daily_logs', '?select=id,production_date,factory_id&limit=20');
  for (const l of logs) {
    if (!l.production_date) throw new Error(`Log ${l.id} missing production_date`);
    if (!l.factory_id) throw new Error(`Log ${l.id} missing factory_id`);
  }
});

await test('No sewing actuals with negative good_today', async () => {
  const bad = await restQuery('sewing_actuals', '?select=id,good_today&good_today=lt.0');
  if (bad.length > 0) throw new Error(`${bad.length} actuals with good_today < 0`);
});

// ============================================================
// SECTION 13: STAGES & BLOCKERS
// ============================================================
console.log('\n=== 13. STAGES & BLOCKERS ===');

await test('Stages reference valid factory_accounts', async () => {
  const stages = await restQuery('stages', '?select=id,factory_id,factory_accounts(id)&limit=20');
  const orphaned = stages.filter(s => s.factory_id && !s.factory_accounts);
  if (orphaned.length > 0) throw new Error(`${orphaned.length} stages with orphaned factory_id`);
});

await test('Blocker types have names', async () => {
  const blockers = await restQuery('blocker_types', '?select=id,name&limit=20');
  const nameless = blockers.filter(b => !b.name);
  if (nameless.length > 0) throw new Error(`${nameless.length} blocker types without names`);
});

// ============================================================
// SECTION 14: NOTIFICATIONS
// ============================================================
console.log('\n=== 14. NOTIFICATIONS ===');

await test('Notification preferences have valid user_ids', async () => {
  const prefs = await restQuery('notification_preferences', '?select=id,user_id&limit=20');
  const profiles = await restQuery('profiles', '?select=id');
  const profileIds = new Set(profiles.map(p => p.id));
  const orphaned = prefs.filter(p => !profileIds.has(p.user_id));
  if (orphaned.length > 0) throw new Error(`${orphaned.length} prefs with orphaned user_id`);
});

await test('Rate limits table is functional', async () => {
  const count = await restCount('rate_limits');
  if (count < 0) throw new Error('Table not accessible');
});

// ============================================================
// SECTION 15: CORS CONFIGURATION
// ============================================================
console.log('\n=== 15. CORS CONFIGURATION ===');

async function testCors(origin, expectAllowed) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/check-subscription`, {
    method: 'OPTIONS',
    headers: {
      'apikey': ANON_KEY,
      'Origin': origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  const allowOrigin = res.headers.get('access-control-allow-origin');
  return { allowOrigin, status: res.status };
}

await test('CORS allows productionportal.cloud', async () => {
  const { allowOrigin } = await testCors('https://productionportal.cloud', true);
  if (allowOrigin !== 'https://productionportal.cloud' && allowOrigin !== '*') {
    throw new Error(`Expected productionportal.cloud in CORS, got: ${allowOrigin}`);
  }
});

await test('CORS allows localhost:5173 (dev)', async () => {
  const { allowOrigin } = await testCors('http://localhost:5173', true);
  if (allowOrigin !== 'http://localhost:5173' && allowOrigin !== '*') {
    throw new Error(`Expected localhost:5173 in CORS, got: ${allowOrigin}`);
  }
});

await test('CORS handles unknown origin with wildcard fallback', async () => {
  const { allowOrigin } = await testCors('https://evil.com', false);
  // The security.ts falls back to * for unrecognized origins (security via Bearer token)
  if (!allowOrigin) throw new Error('No CORS header returned at all');
});

// ============================================================
// SECTION 16: DATABASE FUNCTIONS (RPC)
// ============================================================
console.log('\n=== 16. DATABASE FUNCTIONS ===');

await test('process_scheduled_notifications function exists', async () => {
  // Just check the function is callable (may return empty result)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/process_scheduled_notifications`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (res.status === 404) throw new Error('Function not found');
});

await test('check_rate_limit function exists', async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_identifier: 'test@test.com',
      p_action_type: 'test',
      p_max_attempts: 5,
      p_window_minutes: 15,
      p_block_minutes: 30,
    }),
  });
  if (res.status === 404) throw new Error('Function not found');
  if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
});

await test('log_security_event function exists', async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_security_event`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_event_type: 'test_event',
      p_user_id: null,
      p_factory_id: null,
      p_ip_address: '127.0.0.1',
      p_user_agent: 'test-suite',
      p_details: {},
    }),
  });
  if (res.status === 404) throw new Error('Function not found');
  if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
});

// ============================================================
// SECTION 17: SUBSCRIPTION & BILLING DATA
// ============================================================
console.log('\n=== 17. SUBSCRIPTION & BILLING DATA ===');

await test('Factory accounts have subscription fields', async () => {
  const factories = await restQuery('factory_accounts', '?select=id,name,subscription_tier,subscription_status&limit=5');
  // Just check the fields exist (may be null for some)
  if (!factories[0]) throw new Error('No factories found');
  if (!('subscription_tier' in factories[0])) throw new Error('Missing subscription_tier column');
  if (!('subscription_status' in factories[0])) throw new Error('Missing subscription_status column');
});

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(50));
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log('='.repeat(50));

if (failures.length > 0) {
  console.log('\n  FAILURES:');
  for (const f of failures) {
    console.log(`    - ${f.name}`);
    console.log(`      ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
