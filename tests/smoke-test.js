/**
 * TaskFlow end-to-end smoke test.
 * Runs against your RUNNING backend and checks every feature in the project plan:
 * auth, roles, projects, members, sprints, tasks, filters, comments,
 * time logs (incl. the 24-hour rule) and the report endpoint.
 *
 * Needs Node 18+ (built-in fetch) and no installs.
 *
 *   PowerShell:  $env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="yourpassword"; node tests/smoke-test.js
 *   cmd.exe:     set ADMIN_EMAIL=you@example.com
 *                set ADMIN_PASSWORD=yourpassword
 *                node tests\smoke-test.js
 *
 * Optional: API_URL (default http://localhost:5000/api)
 * Passwords and tokens are never printed.
 */
const API = process.env.API_URL || 'http://localhost:5000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const results = { pass: 0, fail: 0, warn: 0 };
const createdProjects = [];

function pass(name) { results.pass++; console.log(`  PASS  ${name}`); }
function fail(name, detail) { results.fail++; console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`); }
function warn(name, detail) { results.warn++; console.log(`  WARN  ${name}${detail ? '  -> ' + detail : ''}`); }
function check(name, cond, detail) { return cond ? pass(name) : fail(name, detail); }

async function call(method, path, { token, body, rawBody } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(body !== undefined || rawBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  let data = null;
  try { data = type.includes('json') ? await res.json() : await res.text(); } catch { /* empty body */ }
  return { status: res.status, data, type };
}

async function section(title, fn) {
  console.log(`\n${title}`);
  try { await fn(); } catch (err) { fail(`${title} stopped early`, err.message); }
}

const stamp = Date.now();
const PASSWORD = 'Smoke#12345';
const emailOf = (tag) => `smoke_${stamp}_${tag}@example.com`;
const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

async function main() {
  console.log(`TaskFlow smoke test  (${API})`);

  // 0. Server reachable
  const health = await call('GET', '/health').catch(() => null);
  if (!health) {
    console.log('\nCannot reach the server. Start the backend (npm run dev in the backend folder) and try again.');
    process.exit(2);
  }
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('\nSet ADMIN_EMAIL and ADMIN_PASSWORD first (your admin login). See the top of this file.');
    process.exit(2);
  }

  const ctx = {};

  await section('1. Server and database', async () => {
    check('GET /health returns ok + database connected',
      health.status === 200 && health.data?.database === 'connected', `status ${health.status}`);
  });

  await section('2. Registration and login', async () => {
    let r = await call('POST', '/auth/register', { body: { name: 'Smoke A', email: emailOf('a'), password: PASSWORD, role: 'admin' } });
    check('register new user -> 201', r.status === 201, `status ${r.status}`);
    ctx.memberToken = r.data?.token; ctx.memberId = r.data?.user?.id;
    check('new user is always a "member" (cannot self-promote to admin)', r.data?.user?.role === 'member', `role ${r.data?.user?.role}`);

    r = await call('POST', '/auth/register', { body: { name: 'Smoke A', email: emailOf('a'), password: PASSWORD } });
    check('duplicate email -> 409', r.status === 409, `status ${r.status}`);
    r = await call('POST', '/auth/register', { body: { name: 'X', email: emailOf('short'), password: '123' } });
    check('short password -> 400', r.status === 400, `status ${r.status}`);
    r = await call('POST', '/auth/register', { body: { email: emailOf('noname') } });
    check('missing fields -> 400', r.status === 400, `status ${r.status}`);

    r = await call('POST', '/auth/login', { body: { email: emailOf('a'), password: 'wrong-password' } });
    check('wrong password -> 401', r.status === 401, `status ${r.status}`);
    r = await call('POST', '/auth/login', { body: { email: emailOf('a'), password: PASSWORD } });
    check('correct login -> 200 + token', r.status === 200 && !!r.data?.token, `status ${r.status}`);

    r = await call('GET', '/auth/me');
    check('/auth/me without token -> 401', r.status === 401, `status ${r.status}`);
    r = await call('GET', '/auth/me', { token: 'not.a.real.token' });
    check('/auth/me with fake token -> 401', r.status === 401, `status ${r.status}`);
    r = await call('GET', '/auth/me', { token: ctx.memberToken });
    check('/auth/me with real token returns the user', r.status === 200 && r.data?.email === emailOf('a'), `status ${r.status}`);

    // second member who will NOT be added to the project
    r = await call('POST', '/auth/register', { body: { name: 'Smoke Outsider', email: emailOf('b'), password: PASSWORD } });
    ctx.outsiderToken = r.data?.token; ctx.outsiderId = r.data?.user?.id;

    r = await call('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    check('admin login -> 200', r.status === 200 && !!r.data?.token, `status ${r.status} (check ADMIN_EMAIL / ADMIN_PASSWORD)`);
    check('admin account has role "admin"', r.data?.user?.role === 'admin', `role ${r.data?.user?.role}`);
    ctx.adminToken = r.data?.token; ctx.adminId = r.data?.user?.id;
    if (!ctx.adminToken || !ctx.memberToken) throw new Error('cannot continue without admin and member tokens');
  });

  await section('3. Role-based access', async () => {
    let r = await call('GET', '/users', { token: ctx.memberToken });
    check('member cannot list users -> 403', r.status === 403, `status ${r.status}`);
    r = await call('GET', '/users', { token: ctx.adminToken });
    check('admin can list users', r.status === 200 && Array.isArray(r.data), `status ${r.status}`);
    r = await call('PATCH', `/users/${ctx.memberId}/role`, { token: ctx.memberToken, body: { role: 'admin' } });
    check('member cannot change roles -> 403', r.status === 403, `status ${r.status}`);
    r = await call('POST', '/projects', { token: ctx.memberToken, body: { name: 'Nope' } });
    check('member cannot create a project -> 403', r.status === 403, `status ${r.status}`);
  });

  await section('4. Projects and membership', async () => {
    let r = await call('POST', '/projects', { token: ctx.adminToken, body: { name: `Smoke Project ${stamp}`, description: 'automated test' } });
    check('admin creates project -> 201', r.status === 201 && !!r.data?.id, `status ${r.status}`);
    ctx.projectId = r.data?.id; if (ctx.projectId) createdProjects.push(ctx.projectId);
    r = await call('POST', '/projects', { token: ctx.adminToken, body: { name: `Smoke Project 2 ${stamp}` } });
    ctx.project2Id = r.data?.id; if (ctx.project2Id) createdProjects.push(ctx.project2Id);
    if (!ctx.projectId || !ctx.project2Id) throw new Error('project creation failed');

    r = await call('POST', '/projects', { token: ctx.adminToken, body: { name: '   ' } });
    check('blank project name -> 400', r.status === 400, `status ${r.status}`);

    r = await call('GET', '/projects', { token: ctx.memberToken });
    check('non-member does not see the project in their list',
      r.status === 200 && !r.data.some((p) => p.id === ctx.projectId), `status ${r.status}`);
    r = await call('GET', `/projects/${ctx.projectId}`, { token: ctx.memberToken });
    check('non-member cannot open the project -> 403', r.status === 403, `status ${r.status}`);

    r = await call('POST', `/projects/${ctx.projectId}/members`, { token: ctx.adminToken, body: { user_id: ctx.memberId } });
    check('admin adds member -> 201', r.status === 201, `status ${r.status}`);
    r = await call('GET', '/projects', { token: ctx.memberToken });
    check('member now sees the project', r.status === 200 && r.data.some((p) => p.id === ctx.projectId), `status ${r.status}`);
    r = await call('GET', `/projects/${ctx.projectId}`, { token: ctx.memberToken });
    check('member can open it and sees the team list',
      r.status === 200 && r.data.members?.some((m) => m.id === ctx.memberId), `status ${r.status}`);
    r = await call('PATCH', `/projects/${ctx.projectId}`, { token: ctx.memberToken, body: { name: 'Hacked' } });
    check('member cannot edit the project -> 403', r.status === 403, `status ${r.status}`);
    r = await call('DELETE', `/projects/${ctx.projectId}`, { token: ctx.memberToken });
    check('member cannot delete the project -> 403', r.status === 403, `status ${r.status}`);
  });

  await section('5. Sprints', async () => {
    let r = await call('POST', `/projects/${ctx.projectId}/sprints`, { token: ctx.adminToken, body: { name: 'Sprint 1', start_date: '2026-10-12', end_date: '2026-10-25' } });
    check('admin creates sprint -> 201', r.status === 201 && !!r.data?.id, `status ${r.status}`);
    ctx.sprintId = r.data?.id;
    r = await call('POST', `/projects/${ctx.project2Id}/sprints`, { token: ctx.adminToken, body: { name: 'Other project sprint' } });
    ctx.sprint2Id = r.data?.id;
    r = await call('POST', `/projects/${ctx.projectId}/sprints`, { token: ctx.adminToken, body: { name: 'Bad', start_date: '2026-10-25', end_date: '2026-10-12' } });
    check('end date before start date -> 400', r.status === 400, `status ${r.status}`);
    r = await call('POST', `/projects/${ctx.projectId}/sprints`, { token: ctx.memberToken, body: { name: 'Nope' } });
    check('member cannot create sprint -> 403', r.status === 403, `status ${r.status}`);
    r = await call('GET', `/projects/${ctx.projectId}/sprints`, { token: ctx.memberToken });
    check('member can list sprints', r.status === 200 && r.data.some((s) => s.id === ctx.sprintId), `status ${r.status}`);
  });

  await section('6. Tasks, filters and comments', async () => {
    const base = `/projects/${ctx.projectId}/tasks`;
    let r = await call('POST', base, { token: ctx.memberToken, body: { title: 'Design login page', priority: 'high', sprint_id: ctx.sprintId, assignee_id: ctx.memberId } });
    check('member creates task -> 201', r.status === 201 && !!r.data?.id, `status ${r.status}`);
    ctx.taskId = r.data?.id;
    if (!ctx.taskId) throw new Error('task creation failed');

    r = await call('POST', base, { token: ctx.memberToken, body: { title: 'Throwaway task' } });
    ctx.task2Id = r.data?.id;

    r = await call('POST', base, { token: ctx.memberToken, body: { title: '' } });
    check('empty title -> 400', r.status === 400, `status ${r.status}`);
    r = await call('POST', base, { token: ctx.memberToken, body: { title: 'x', status: 'finished' } });
    check('invalid status -> 400', r.status === 400, `status ${r.status}`);
    r = await call('POST', base, { token: ctx.memberToken, body: { title: 'x', assignee_id: ctx.outsiderId } });
    check('cannot assign to someone outside the project -> 400', r.status === 400, `status ${r.status}`);
    r = await call('POST', base, { token: ctx.memberToken, body: { title: 'x', sprint_id: ctx.sprint2Id } });
    check('cannot use a sprint from another project -> 400', r.status === 400, `status ${r.status}`);
    r = await call('POST', base, { token: ctx.outsiderToken, body: { title: 'x' } });
    check('non-member cannot create tasks -> 403', r.status === 403, `status ${r.status}`);

    r = await call('PATCH', `/tasks/${ctx.taskId}`, { token: ctx.memberToken, body: { status: 'in_progress' } });
    check('move task to In Progress -> 200', r.status === 200, `status ${r.status}`);
    r = await call('GET', `/tasks/${ctx.taskId}`, { token: ctx.memberToken });
    check('status change was saved', r.data?.status === 'in_progress', `status is ${r.data?.status}`);
    r = await call('GET', `${base}?status=in_progress`, { token: ctx.memberToken });
    check('filter by status works', r.status === 200 && r.data.some((t) => t.id === ctx.taskId) && r.data.every((t) => t.status === 'in_progress'), `status ${r.status}`);
    r = await call('GET', `${base}?status=bogus`, { token: ctx.memberToken });
    check('invalid filter value -> 400', r.status === 400, `status ${r.status}`);
    r = await call('PATCH', `/tasks/${ctx.taskId}`, { token: ctx.memberToken, body: { status: 'finished' } });
    check('invalid status on update -> 400', r.status === 400, `status ${r.status}`);

    r = await call('DELETE', `/tasks/${ctx.task2Id}`, { token: ctx.memberToken });
    check('member cannot delete a task -> 403', r.status === 403, `status ${r.status}`);
    r = await call('DELETE', `/tasks/${ctx.task2Id}`, { token: ctx.adminToken });
    check('admin can delete a task', r.status === 200, `status ${r.status}`);

    r = await call('POST', `/tasks/${ctx.taskId}/comments`, { token: ctx.memberToken, body: { body: 'Started working on this' } });
    check('post comment -> 201', r.status === 201, `status ${r.status}`);
    r = await call('POST', `/tasks/${ctx.taskId}/comments`, { token: ctx.memberToken, body: { body: '  ' } });
    check('empty comment -> 400', r.status === 400, `status ${r.status}`);
    r = await call('GET', `/tasks/${ctx.taskId}/comments`, { token: ctx.memberToken });
    check('comment is listed', r.status === 200 && r.data.some((c) => c.body === 'Started working on this'), `status ${r.status}`);
  });

  await section('7. Time logging (Phase 5)', async () => {
    const url = `/tasks/${ctx.taskId}/time-logs`;
    let r = await call('POST', url, { token: ctx.memberToken, body: { hours: 0, log_date: today } });
    check('0 hours -> 400', r.status === 400, `status ${r.status}`);
    r = await call('POST', url, { token: ctx.memberToken, body: { hours: 25, log_date: today } });
    check('25 hours -> 400', r.status === 400, `status ${r.status}`);
    r = await call('POST', url, { token: ctx.memberToken, body: { hours: 1, log_date: 'not-a-date' } });
    check('bad date -> 400', r.status === 400, `status ${r.status}`);

    r = await call('POST', url, { token: ctx.memberToken, body: { hours: 2, log_date: today, note: 'first' } });
    check('log 2 hours -> 201', r.status === 201, `status ${r.status}`);
    ctx.logToDeleteByAdmin = r.data?.id;
    r = await call('POST', url, { token: ctx.memberToken, body: { hours: 20, log_date: today } });
    check('log 20 more hours the same day (22 total) -> 201', r.status === 201, `status ${r.status}`);
    ctx.logToDeleteByMember = r.data?.id;
    r = await call('POST', url, { token: ctx.memberToken, body: { hours: 3, log_date: today } });
    check('going over 24 hours in one day is rejected -> 400', r.status === 400, `status ${r.status}: ${r.data?.message}`);

    r = await call('GET', url, { token: ctx.memberToken });
    const total = Array.isArray(r.data) ? r.data.reduce((s, l) => s + Number(l.hours), 0) : -1;
    check('time entries listed and add up to 22h', r.status === 200 && Math.abs(total - 22) < 0.001, `total ${total}`);
    r = await call('POST', url, { token: ctx.outsiderToken, body: { hours: 1, log_date: today } });
    check('non-member cannot log time -> 403', r.status === 403, `status ${r.status}`);
    r = await call('DELETE', `/time-logs/${ctx.logToDeleteByMember}`, { token: ctx.outsiderToken });
    check('non-member cannot delete entries -> 403', r.status === 403, `status ${r.status}`);

    // report is checked while the 22 hours still exist
    r = await call('GET', `/projects/${ctx.projectId}/report`, { token: ctx.memberToken });
    check('report endpoint works for a member', r.status === 200, `status ${r.status}`);
    if (r.status === 200) {
      check('report: total hours = 22', Math.abs(r.data.totals.total_hours - 22) < 0.001, `got ${r.data.totals.total_hours}`);
      check('report: 1 task in the project (the throwaway was deleted)', r.data.totals.total_tasks === 1, `got ${r.data.totals.total_tasks}`);
      const sp = r.data.sprints.find((s) => s.id === ctx.sprintId);
      check('report: sprint shows 1 task and 22 hours', sp && sp.task_count === 1 && Math.abs(sp.hours - 22) < 0.001, JSON.stringify(sp));
      const me = r.data.members.find((m) => m.id === ctx.memberId);
      check('report: member row shows 22 hours', me && Math.abs(me.hours - 22) < 0.001, JSON.stringify(me));
    }
    r = await call('GET', `/projects/${ctx.projectId}/report`, { token: ctx.outsiderToken });
    check('report is blocked for non-members -> 403', r.status === 403, `status ${r.status}`);

    r = await call('DELETE', `/time-logs/${ctx.logToDeleteByAdmin}`, { token: ctx.adminToken });
    check('admin can delete someone else\'s entry', r.status === 200, `status ${r.status}`);
    r = await call('DELETE', `/time-logs/${ctx.logToDeleteByMember}`, { token: ctx.memberToken });
    check('member can delete their own entry', r.status === 200, `status ${r.status}`);
  });

  await section('8. Robustness (WARN = works, but worth hardening)', async () => {
    let r = await call('POST', '/auth/login', { rawBody: '{ "email": "a@b.com", ' });
    if (r.status === 400 && r.type.includes('json')) pass('malformed JSON returns a clean JSON error');
    else warn('malformed JSON does not return a clean JSON error', `status ${r.status}, content-type "${r.type}"`);

    r = await call('POST', '/auth/register', { body: { name: 'Bad Email', email: `smoke-bad-email-${stamp}`, password: PASSWORD } });
    if (r.status === 400) pass('invalid email address is rejected');
    else warn('invalid email address was accepted', `status ${r.status}`);

    r = await call('GET', `/projects/${ctx.projectId}abc`, { token: ctx.adminToken });
    if (r.status === 400 || r.status === 404) pass('malformed id "1abc" is rejected');
    else warn('malformed id "123abc" is treated as 123', `status ${r.status}`);

    r = await call('PATCH', '/users/999999999/role', { token: ctx.adminToken, body: { role: 'member' } });
    if (r.status === 404) pass('changing role of a non-existent user -> 404');
    else warn('changing role of a non-existent user reports success', `status ${r.status}`);

    r = await call('POST', `/projects/${ctx.projectId}/sprints`, { token: ctx.adminToken, body: { name: 'Bad date', start_date: 'hello' } });
    if (r.status === 400) pass('invalid sprint date -> 400');
    else warn('invalid sprint date gives a server error instead of a clear message', `status ${r.status}`);
  });

  await section('9. Cleanup', async () => {
    for (const id of createdProjects) {
      const r = await call('DELETE', `/projects/${id}`, { token: ctx.adminToken });
      check(`delete test project ${id} (and its tasks/sprints/logs)`, r.status === 200, `status ${r.status}`);
    }
  });

  console.log(`\n==== ${results.pass} passed, ${results.fail} failed, ${results.warn} warnings ====`);
  console.log(`Test users remain in the database. Remove them in MySQL Workbench with:`);
  console.log(`  DELETE FROM users WHERE email LIKE 'smoke%';`);
  process.exit(results.fail ? 1 : 0);
}

main().catch((err) => { console.error('\nUnexpected error:', err.message); process.exit(2); });
