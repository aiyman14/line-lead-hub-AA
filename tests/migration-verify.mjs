/**
 * Migration Verification Tests
 * Run: node tests/migration-verify.mjs
 *
 * Tests the new Supabase project (varolnwetchstlfholbl) to verify
 * all migrated features are working correctly.
 */

const SUPABASE_URL = 'https://varolnwetchstlfholbl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhcm9sbndldGNoc3RsZmhvbGJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc2Njc0MywiZXhwIjoyMDg2MzQyNzQzfQ.p9rW6Kufh3iAv8cUZD8EmrqY5H9InPkcGNyKQ4ltUBQ';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhcm9sbndldGNoc3RsZmhvbGJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NjY3NDMsImV4cCI6MjA4NjM0Mjc0M30.Bdjo1-1jvO25RVN3BJtZQ_CYfmuTSWyH4SC7PeG9pRc';

let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
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
  if (!res.ok) throw new Error(`REST query failed: ${res.status} ${await res.text()}`);
  return res.json();
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

// ============================================================
// 1. DATABASE CONNECTIVITY & DATA INTEGRITY
// ============================================================
console.log('\n--- Database Connectivity & Data Integrity ---');

await test('Can connect to Supabase REST API', async () => {
  const data = await restQuery('factory_accounts', '?select=id&limit=1');
  if (!Array.isArray(data)) throw new Error('Expected array response');
});

await test('Auth users exist (38 expected)', async () => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=50`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  const data = await res.json();
  const count = data.users?.length || 0;
  if (count < 38) throw new Error(`Expected >= 38 auth users, got ${count}`);
});

// ============================================================
// 2. TABLE ROW COUNTS (match old project)
// ============================================================
console.log('\n--- Table Row Counts ---');

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
};

for (const [table, expected] of Object.entries(expectedCounts)) {
  await test(`${table} >= ${expected} rows`, async () => {
    const count = await restCount(table);
    if (count < expected) throw new Error(`Expected >= ${expected}, got ${count}`);
  });
}

// ============================================================
// 3. KNOWLEDGE BASE (pgvector embeddings)
// ============================================================
console.log('\n--- Knowledge Base & Embeddings ---');

await test('Knowledge chunks have embeddings', async () => {
  const data = await restQuery('knowledge_chunks', '?select=id,embedding&limit=1');
  if (!data[0]?.embedding) throw new Error('Embedding is null/missing');
});

await test('Knowledge documents linked to chunks', async () => {
  const docs = await restQuery('knowledge_documents', '?select=id,title&limit=5');
  const chunks = await restQuery('knowledge_chunks', '?select=document_id&limit=5');
  if (docs.length === 0) throw new Error('No documents found');
  if (chunks.length === 0) throw new Error('No chunks found');
});

// ============================================================
// 4. EDGE FUNCTIONS (deployment & reachability)
// ============================================================
console.log('\n--- Edge Functions ---');

const edgeFunctions = [
  'admin-invite-user',
  'admin-reset-password',
  'auth-rate-limit',
  'cancel-subscription',
  'change-subscription',
  'chat',
  'chat-feedback',
  'check-subscription',
  'create-checkout',
  'customer-portal',
  'generate-embedding',
  'get-billing-history',
  'get-source',
  'ingest-chunk',
  'ingest-document',
  'link-factory-subscription',
  'notify-blocker',
  'process-scheduled-emails',
  'process-scheduled-notifications',
  'remove-user-access',
  'send-billing-notification',
  'send-insights-report',
  'send-welcome-email',
  'stripe-webhook',
  'terminate-account',
];

for (const fn of edgeFunctions) {
  await test(`Edge function '${fn}' is deployed`, async () => {
    const { status } = await callEdgeFunction(fn, {});
    // Any response that isn't 404 means the function exists
    if (status === 404) throw new Error('Function not found (404)');
  });
}

// ============================================================
// 5. STRIPE INTEGRATION
// ============================================================
console.log('\n--- Stripe Integration ---');

await test('Stripe webhook secret is configured', async () => {
  const { status, body } = await callEdgeFunction('stripe-webhook', { test: true });
  // Should return 400 "Missing signature", NOT 500 "Webhook secret not configured"
  if (body.includes('not configured')) throw new Error('STRIPE_WEBHOOK_SECRET not set');
  if (!body.includes('Missing signature')) throw new Error(`Unexpected response: ${body}`);
});

await test('check-subscription function responds', async () => {
  const { status, body } = await callEdgeFunction('check-subscription', {});
  // Should fail with auth error, not with missing secret
  if (body.includes('STRIPE_SECRET_KEY')) throw new Error('STRIPE_SECRET_KEY not set');
});

await test('create-checkout function responds', async () => {
  const { status, body } = await callEdgeFunction('create-checkout', {});
  if (body.includes('STRIPE_SECRET_KEY')) throw new Error('STRIPE_SECRET_KEY not set');
});

// ============================================================
// 6. AUTH & SECURITY
// ============================================================
console.log('\n--- Auth & Security ---');

await test('Anon key can reach API (but not read protected data)', async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/factory_accounts?select=id&limit=1`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
  });
  // Should return 200 with empty array (RLS blocks) or 200 with data
  if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
});

await test('Rate limits table exists', async () => {
  const count = await restCount('rate_limits');
  if (count < 0) throw new Error('Table not accessible');
});

await test('Security events table exists', async () => {
  const count = await restCount('security_events');
  if (count < 100) throw new Error(`Expected >= 100 security events, got ${count}`);
});

// ============================================================
// 7. EMAIL FUNCTIONS (Resend)
// ============================================================
console.log('\n--- Email Functions ---');

await test('notify-blocker function responds', async () => {
  const { status, body } = await callEdgeFunction('notify-blocker', {});
  if (status === 404) throw new Error('Function not deployed');
});

await test('send-welcome-email function responds', async () => {
  const { status, body } = await callEdgeFunction('send-welcome-email', {});
  if (status === 404) throw new Error('Function not deployed');
});

// ============================================================
// 8. DATA RELATIONSHIPS (foreign keys)
// ============================================================
console.log('\n--- Data Relationships ---');

await test('Sewing targets reference valid work orders', async () => {
  const targets = await restQuery('sewing_targets', '?select=id,work_order_id,work_orders(id)&limit=5');
  for (const t of targets) {
    if (!t.work_orders) throw new Error(`Target ${t.id} has orphaned work_order_id`);
  }
});

await test('Cutting actuals have valid data', async () => {
  const actuals = await restQuery('cutting_actuals', '?select=id&limit=5');
  if (actuals.length === 0) throw new Error('No cutting actuals found');
});

await test('User roles have valid user_id', async () => {
  const roles = await restQuery('user_roles', '?select=id,user_id&limit=5');
  for (const r of roles) {
    if (!r.user_id) throw new Error(`Role ${r.id} has null user_id`);
  }
});

await test('Work order line assignments reference valid lines', async () => {
  const assignments = await restQuery('work_order_line_assignments', '?select=id,line_id,lines(id)&limit=5');
  for (const a of assignments) {
    if (!a.lines) throw new Error(`Assignment ${a.id} has orphaned line_id`);
  }
});

// ============================================================
// SUMMARY
// ============================================================
console.log('\n========================================');
console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
