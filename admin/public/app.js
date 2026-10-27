import { escapeHtml as e, text, number, date, usd, packingCount, packingProgress, filterPacking, userIdentity } from './model.mjs';

const paths = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m1-17a3 3 0 0 1 0 6m3 11v-2a6 6 0 0 0-2-4"/>',
  trips: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/>',
  packing: '<rect x="5" y="5" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/><path d="m9 14 2 2 4-4"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 11-2l3 3M4 16l3 3a7 7 0 0 0 11-2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  logout: '<path d="M9 4H4v16h5m7-12 4 4-4 4m-7-4h11"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  backup: '<path d="M8 18H6a4 4 0 1 1 .4-8 6 6 0 0 1 11.7-1A4.5 4.5 0 0 1 18 18h-2m-4 3V11m-4 4 4-4 4 4"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.trips}</svg>`;
const $ = (selector) => document.querySelector(selector);
const titles = { overview: 'Overview', users: 'Users', trips: 'Shared journeys', packing: 'Packing lists' };
const state = { config: null, user: null, csrf: null, route: 'overview', page: 1, query: '', status: 'all', items: [], request: null, sequence: 0, detail: null, detailId: null, detailTab: 'trip', detailRequest: null, packingQuery: '', packingFilter: 'all', loginBusy: false, deleting: false, connectionError: false, editingUser: null, userBusy: false, inviteBusy: false };
state.source = 'live'; // Never persisted. Every fresh session starts with live data.
let searchTimer; let toastTimer;
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000); }

async function api(path, { method = 'GET', body, signal } = {}) {
  const controller = new AbortController(); let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort(); signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
  try {
    const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: { ...(/^\/api\/(users|trips|overview)(?:[/?]|$)/.test(path) ? { 'X-Waylo-Data-Source': state.source } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method === 'POST' && state.csrf ? { 'X-Waylo-CSRF': state.csrf } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
    const result = await response.json();
    if (!response.ok) {
      if ([401, 403].includes(response.status) && path !== '/api/login') {
        state.user = null; state.csrf = null; state.source = 'live'; state.items = []; state.detail = null; state.editingUser = null;
        $('#invite-form').reset();
        $('#confirm-dialog').close(); $('#detail-dialog').close(); $('#invite-dialog').close(); chrome();
        if ($('#data-area')) unavailable(text(result.error, 'Sign in again.'));
      }
      throw new Error(text(result.error, 'The request could not finish.'));
    }
    return result;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) throw new Error('The server took too long. Check the connection and try again.');
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error('The admin server could not be reached. Check that it is running, then retry.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

function chrome() {
  $('#data-source-bar').hidden = !state.user || !state.config?.demoAvailable;
  $('#data-source-bar').classList.toggle('demo-active', state.source === 'demo');
  $('#data-source-label').textContent = state.source === 'demo' ? 'DEMO DATA · Isolated local records. No real accounts or emails.' : 'LIVE DATA · Your Supabase project. Demo records are kept separate.';
  $('#data-source-toggle').textContent = state.source === 'demo' ? 'Return to live data' : 'View demo data';
  $('#navigation').innerHTML = Object.entries(titles).map(([key, label]) => `<a class="nav-link${state.route === key ? ' active' : ''}" href="#${key}"${state.route === key ? ' aria-current="page"' : ''}>${icon(key)}<span>${label}</span></a>`).join('');
  $('#breadcrumb').textContent = titles[state.route];
  $('#setup-nav').innerHTML = `${icon('settings')}<span>Connection settings</span>`;
  $('#menu-toggle').innerHTML = icon('menu');
  const live = state.user && !state.connectionError;
  $('#connection').className = `connection-pill${live ? ' live' : ''}`;
  $('#connection').innerHTML = `<span class="status-dot"></span>${state.connectionError ? 'Connection needs attention' : live ? 'Verified admin access' : state.config?.configured ? 'Sign-in required' : 'Setup required'}`;
  $('#identity').innerHTML = state.user ? `<span class="avatar">${e(text(state.user.email, 'A').slice(0, 1).toUpperCase())}</span><div class="identity-text"><strong>${e(state.user.email)}</strong><span>Administrator</span></div><button class="icon-button" data-action="logout" aria-label="Sign out">${icon('logout')}</button>` : `<span class="avatar">${icon('lock')}</span><div class="identity-text"><strong>Private workspace</strong><span>Administrator sign-in</span></div>`;
}
const skeleton = () => '<div class="skeleton" role="status" aria-label="Loading workspace data"><span></span><span></span><span></span></div>';
function formBusy(form, busy) {
  form.setAttribute('aria-busy', String(busy));
  for (const control of form.querySelectorAll('input,textarea,select,button')) control.disabled = busy;
  for (const close of form.closest('dialog')?.querySelectorAll('.dialog-close') ?? []) close.disabled = busy;
}
function empty(title, body, action = '', actionKey = '') { return `<div class="empty"><div class="empty-icon">${icon(state.route === 'users' ? 'users' : state.route === 'packing' ? 'packing' : 'trips')}</div><h3>${e(title)}</h3><p>${e(body)}</p>${action ? `<button class="button secondary" data-action="${actionKey}">${e(action)}</button>` : ''}</div>`; }
function stats(data) {
  return `<div class="statistics">${[
    ['Registered travelers', data?.users, 'users', data ? `${number(data.verified_users)} email-confirmed accounts` : 'Supabase accounts'],
    ['Shared journeys', data?.shared_trips, 'trips', 'Explicitly published trips'],
    ['Packing items', data?.packing_rows, 'packing', 'Rows across shared lists'],
    ['Account backups', data?.account_backups, 'backup', 'Manual cloud backups'],
  ].map(([label, value, name, caption]) => `<article class="stat"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon(name)}</span></div><div class="stat-value">${number(value)}</div><p class="stat-caption">${data ? caption : 'Awaiting workspace data'}</p></article>`).join('')}</div>`;
}
function page() {
  chrome();
  const copy = {
    overview: ['WORKSPACE OVERVIEW', 'Every journey, in good hands.', 'A clear view of your community, shared plans and the little details that matter.'],
    users: ['USER MANAGEMENT', 'Your travel community.', 'Find a traveler, refine their profile or welcome someone new.'],
    trips: ['SHARED JOURNEYS', 'Stories in the making.', 'Explore the travel plans your community has chosen to publish.'],
    packing: ['SHARED PACKING LISTS', 'Every essential, together.', 'A thoughtful view of the packing lists shared by your travelers.'],
  }[state.route];
  $('#main').innerHTML = `<section class="page-heading"><div><p class="eyebrow">${state.user ? copy[0] : 'PRIVATE ADMINISTRATION'}</p><h1>${state.user ? copy[1] : 'A thoughtful workspace.'}</h1><p class="muted">${state.user ? copy[2] : 'A quieter place to look after your travel community.'}</p></div><div class="heading-actions"><button class="icon-button" data-action="refresh" aria-label="Refresh workspace" title="Refresh workspace">${icon('refresh')}</button>${state.route === 'overview' && state.user ? `<a class="button secondary" href="#trips"><span>View journeys</span>${icon('arrow')}</a>` : ''}</div></section>
    ${!state.config?.configured ? `<div class="notice">${icon('info')}<div><strong>Your workspace is waiting for its connection.</strong><p>Configure Supabase to load real travelers, trips and packing lists.</p></div><button class="text-button" data-action="setup">Set up connection ${icon('arrow')}</button></div>` : ''}
    ${state.route !== 'overview' && state.user ? `<div class="toolbar"><div class="search-box">${icon('search')}<input type="search" id="list-search" value="${e(state.query)}" maxlength="100" placeholder="${state.route === 'users' ? 'Search name or email…' : 'Search shared journeys…'}" aria-label="${state.route === 'users' ? 'Search travelers by name or email' : 'Search shared journeys'}"><button class="search-clear icon-button" data-action="clear-search" aria-label="Clear search"${state.query ? '' : ' hidden'}>×</button></div>${state.route !== 'users' ? `<select id="status-filter" aria-label="Trip status">${['all', 'upcoming', 'ongoing', 'past', 'completed', 'unscheduled'].map((s) => `<option value="${s}"${s === state.status ? ' selected' : ''}>${s === 'all' ? 'All journeys' : s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select>` : ''}<span class="result-count" id="result-count"></span></div>` : ''}
    <div id="data-area" aria-live="polite"></div>`;
  window.scrollTo(0, 0);
  void loadPage();
}
function login(error = '') {
  return `<div class="login-grid"><section class="card login-card"><div class="login-lock">${icon('lock')}</div><p class="eyebrow">RESERVED FOR YOUR TEAM</p><h2>A considered space.<br>A secure welcome.</h2><p class="muted">Sign in with an existing Supabase account that has been granted administrator access.</p><form id="login-form"><label for="email">Email address</label><input id="email" name="email" type="email" required autocomplete="username" maxlength="320" placeholder="you@yourcompany.com"><label for="password">Password</label><input id="password" name="password" type="password" required autocomplete="current-password" maxlength="512" placeholder="Your account password"><p class="form-error" id="login-error" role="alert">${e(error)}</p><button class="button" type="submit" id="login-submit">Sign in to your workspace ${icon('arrow')}</button></form><p class="login-footnote">Permissions are verified by the server and database. ${state.config?.demoAvailable ? 'Local demo records are available only after real administrator sign-in.' : 'Only real account data is available.'}</p></section><section class="card editorial-card" aria-label="Waylo brand message"><div class="globe-lines" aria-hidden="true"></div><p class="eyebrow">THE WAYLO WAY</p><h2>Made for journeys.<br>Managed with care.</h2><p>A quiet workspace for the people helping every adventure begin beautifully.</p></section></div>`;
}
function unavailable(error = '') {
  $('#data-area').innerHTML = login(error);
}
async function loadPage() {
  state.request?.abort(); const request = new AbortController(); state.request = request; const seq = ++state.sequence;
  if (!state.user) { unavailable(); return; }
  $('#data-area').innerHTML = state.route === 'overview' ? `${stats(null)}<div class="card">${skeleton()}</div>` : `<div class="card">${skeleton()}</div>`;
  try {
    const endpoint = state.route === 'overview' ? '/api/overview' : `/api/${state.route === 'users' ? 'users' : 'trips'}?page=${state.page}&q=${encodeURIComponent(state.query)}&status=${state.status}`;
    const result = await api(endpoint, { signal: request.signal });
    if (seq !== state.sequence) return;
    state.connectionError = false; chrome();
    if (state.route === 'overview') $('#data-area').innerHTML = overview(result);
    else {
      state.items = result.items ?? [];
      $('#result-count').textContent = `${number(result.total)} ${state.route === 'users' ? result.total === 1 ? 'traveler' : 'travelers' : result.total === 1 ? 'journey' : 'journeys'}`;
      $('#data-area').innerHTML = state.route === 'users' ? users(result) : state.route === 'packing' ? packingLists(result) : trips(result);
    }
  } catch (error) {
    if (request.signal.aborted || seq !== state.sequence) return;
    state.connectionError = true; chrome();
    if (!state.user) unavailable(error.message);
    else $('#data-area').innerHTML = `<section class="card">${empty('A little pause in the journey.', error.message, 'Try again', 'refresh')}</section>`;
  }
}
function overview(data) {
  const signups = Array.isArray(data.signups) ? data.signups : []; const max = Math.max(1, ...signups.map((s) => Number(s.count) || 0));
  return `${stats(data)}<div class="content-grid"><section class="card"><div class="card-header"><div><h3>Recently shared journeys</h3><p>The latest published cloud copies</p></div><a class="text-button" href="#trips">View all ${icon('arrow')}</a></div>${data.recent_trips?.length ? tripTable(data.recent_trips, true) : empty('The next story starts here.', 'Shared trips will appear when a traveler explicitly publishes a journey.')}</section><section class="card"><div class="card-header"><div><h3>A growing travel community</h3><p>Actual account signups · last six months</p></div>${icon('users')}</div><div class="card-body">${signups.map((s) => `<div class="signup-row"><span>${e(s.month)}</span><progress value="${Number(s.count) || 0}" max="${max}" aria-label="${e(s.month)} signups"></progress><strong>${number(s.count)}</strong></div>`).join('')}<p class="small muted">${number(data.verified_users)} email-confirmed accounts · ${number(data.new_users_7d)} new in the last 7 days</p></div></section></div><section class="card"><div class="card-header"><div><h3>Workspace activity</h3><p>Recorded administration actions</p></div><span class="small muted">Updated ${e(date(data.as_of, true))}</span></div>${data.audit?.length ? `<div class="card-body">${data.audit.map((a) => `<div class="audit-item">${icon('trips')}<div><p>${a.action?.startsWith('user_invite_') ? 'User invitation · ' + e(text(a.details?.outcome, 'requested')) : a.action === 'user_profile_updated' ? 'User profile updated' : 'Shared journey deleted · ' + e(text(a.details?.title, 'Untitled journey'))}</p><span>${e(date(a.created_at, true))} · ${e(a.details?.reason)}</span></div></div>`).join('')}</div>` : empty('Everything is in good order.', 'Profile changes, invitation requests and confirmed trip deletions are recorded here. No activity has been recorded yet.')}</section><p class="scroll-note">This view covers cloud-published data. Local-only trips and unpublished edits remain on travelers' devices.</p>`;
}
const badge = (status) => `<span class="badge ${typeof status === 'string' && /^[a-z-]{1,24}$/.test(status) ? status : ''}"><span class="badge-dot" aria-hidden="true"></span>${e(status === 'unconfirmed' ? 'Needs verification' : status)}</span>`;
const routeText = (trip) => Array.isArray(trip.destinations) ? trip.destinations.filter((v) => typeof v === 'string').join(' → ') : '';
function tripTable(items, compact = false) {
  return `<div class="table-wrap"><table><thead><tr><th>JOURNEY</th>${compact ? '' : '<th>TRAVEL DATES</th>'}<th>STATUS</th>${compact ? '' : '<th>TRAVELERS</th>'}<th></th></tr></thead><tbody>${items.map((t) => `<tr><td><div class="cell-name"><span class="journey-icon">${icon('trips')}</span><div><strong>${e(t.title)}</strong><span class="muted">${e(routeText(t) || 'Destination not set')}</span></div></div></td>${compact ? '' : `<td data-label="TRAVEL DATES">${e(date(t.departure))}<br><span class="muted small">to ${e(date(t.end_date))}</span></td>`}<td data-label="STATUS">${badge(t.status)}</td>${compact ? '' : `<td data-label="TRAVELERS">${number(t.travelers)}</td>`}<td><button class="text-button" data-trip="${e(t.id)}" aria-label="Open ${e(t.title)}">View ${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`;
}
function pagination(data) { const pages = Math.max(1, Math.ceil(data.total / data.page_size)); return `<div class="pagination"><span>Page ${number(data.page)} of ${number(pages)} · ${number(data.total)} results</span><div><button class="button secondary" data-page="${data.page - 1}"${data.page <= 1 ? ' disabled' : ''}>Previous</button><button class="button secondary" data-page="${data.page + 1}"${data.page >= pages ? ' disabled' : ''}>Next</button></div></div>`; }
function trips(data) { return `<section class="card">${data.items.length ? tripTable(data.items) : empty(state.query || state.status !== 'all' ? 'No journeys on this route.' : 'Room for a new story.', state.query || state.status !== 'all' ? 'Try a different title or clear your filters.' : 'Trips appear here after they are explicitly shared from the mobile app.', state.query || state.status !== 'all' ? 'Clear filters' : '', 'clear-filters')}${pagination(data)}</section><p class="scroll-note">Each row is a published shared trip, not every trip saved on a phone.</p>`; }
function users(data) {
  return `<div class="user-actions"><p class="muted">${number(data.total)} ${data.demo ? 'demo users · fictional local records' : 'registered users · verified account details'}</p><button class="button" data-action="invite-user">${data.demo ? 'Add demo user' : 'Invite user'} ${icon('arrow')}</button></div><section class="card user-table">${data.items.length ? `<div class="table-wrap"><table><thead><tr><th>TRAVELER</th><th>JOINED</th><th>ACCESS</th><th>SHARED TRIPS</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${data.items.map((u, i) => {
    const identity = userIdentity(u);
    return `<tr><td><div class="cell-name"><span class="avatar">${e(identity.initials)}</span><div><strong>${e(identity.displayName)}</strong><span class="muted">${identity.name ? e(identity.email) : 'Name not provided'}</span></div></div></td><td data-label="JOINED">${e(date(u.created_at))}</td><td data-label="ACCESS"><div class="badge-row">${u.demo ? badge('demo') : ''}${badge(u.email_confirmed_at ? 'verified' : 'unconfirmed')}${u.is_admin ? badge('admin') : badge('traveler')}</div></td><td data-label="SHARED TRIPS">${number(u.shared_trips)}</td><td><button class="text-button" data-user="${i}" aria-label="View account ${e(identity.email)}">Manage ${icon('arrow')}</button></td></tr>`;
  }).join('')}</tbody></table></div>` : empty('No travelers found.', state.query ? 'Try a different name or email address.' : 'Registered Supabase accounts will appear here.', state.query ? 'Clear search' : '', 'clear-filters')}${pagination(data)}</section>`;
}
function packingLists(data) {
  return `${data.items.length ? `<div class="packing-grid">${data.items.map((t) => `<article class="card packing-card"><span class="journey-icon">${icon('packing')}</span><div><div class="badge-row">${badge(t.status)}</div><h3>${e(t.title)}</h3></div><p>${e(routeText(t) || 'Destination not set')}<br>${e(date(t.departure))}</p><div><p class="list-count">${number(t.packing_rows)} packing rows · ${number(t.members)} members</p><p>Published revision ${number(t.revision)}</p></div><button class="button secondary" data-trip="${e(t.id)}" data-tab="packing">View packing list ${icon('arrow')}</button></article>`).join('')}</div><div class="card">${pagination(data)}</div>` : `<section class="card">${empty('A place for every essential.', state.query || state.status !== 'all' ? 'No shared lists match these filters.' : 'Published trip packing lists will appear here. Local packing stays on the device.', state.query || state.status !== 'all' ? 'Clear filters' : '', 'clear-filters')}${pagination(data)}</section>`}<p class="scroll-note">Packing lists are read-only published snapshots. Traveler edits remain in the mobile app until published.</p>`;
}

async function openTrip(id, tab = 'trip') {
  state.detailRequest?.abort(); const request = new AbortController(); state.detailRequest = request;
  state.detailId = id; state.detailTab = tab; state.detail = null; state.packingQuery = ''; state.packingFilter = 'all';
  $('#detail-content').innerHTML = `<div class="drawer-head"><h2 id="detail-title">Opening this journey…</h2><button class="dialog-close icon-button" data-action="close-detail" aria-label="Close journey">×</button></div>${skeleton()}`;
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
  try { const data = await api(`/api/trips/${encodeURIComponent(id)}`, { signal: request.signal }); if (request.signal.aborted) return; state.detail = data; renderDetail(); }
  catch (error) { if (!request.signal.aborted) $('#detail-content').innerHTML = `<div class="drawer-head"><h2 id="detail-title">Journey unavailable.</h2><button class="dialog-close icon-button" data-action="close-detail" aria-label="Close journey">×</button></div>${empty('We could not open this journey.', error.message, 'Try again', 'retry-detail')}`; }
}
function renderDetail() {
  const d = state.detail; if (!d) return; const s = d.summary;
  $('#detail-content').innerHTML = `<div class="drawer-head"><p class="eyebrow">SHARED JOURNEY · REVISION ${number(s.revision)}</p><h2 id="detail-title">${e(s.title)}</h2><p class="muted">${e(text(s.owner_email, 'Owner email unavailable'))} · Updated ${e(date(s.updated_at, true))}</p><div class="detail-tabs" role="group" aria-label="Journey views">${[['trip', 'Itinerary'], ['packing', 'Packing list'], ['members', 'Members']].map(([key, label]) => `<button data-detail-tab="${key}" class="${state.detailTab === key ? 'active' : ''}" aria-pressed="${state.detailTab === key}">${label}</button>`).join('')}</div><button class="dialog-close icon-button" data-action="close-detail" aria-label="Close journey">×</button></div><div class="drawer-body">${state.detailTab === 'trip' ? tripDetail(d) : state.detailTab === 'packing' ? packingDetail(d) : membersDetail(d)}</div>`;
}
function tripDetail(d) {
  const t = d.document?.trip; if (!t) return empty('Trip data is incomplete.', 'The published document has no trip details.');
  const stops = Array.isArray(t.stops) ? t.stops.filter((s) => s && typeof s === 'object') : []; const entries = Array.isArray(t.itinerary) ? t.itinerary.filter((a) => a && typeof a === 'object').sort((a, b) => a.day - b.day || String(a.time).localeCompare(String(b.time))) : [];
  return `<dl class="detail-facts"><div><dt>DEPARTURE</dt><dd>${e(date(t.departure))}</dd></div><div><dt>RETURN</dt><dd>${e(date(t.endDate))}</dd></div><div><dt>TRAVELERS</dt><dd>${number(t.travelers)}</dd></div><div><dt>ESTIMATED GROUP BUDGET · USD</dt><dd>${e(usd(t.budget))}</dd></div></dl><section class="detail-section"><h3>A journey in chapters</h3>${stops.length ? stops.map((s, i) => `<div class="route-stop"><span class="stop-number">${i + 1}</span><div><strong>${e(text(s.place?.name, 'Destination not set'))}</strong><p>${e(s.place?.country)} · ${e(date(s.arrival))} – ${e(date(s.departure))}</p></div></div>`).join('') : '<p class="muted small">No route stops in this published copy.</p>'}</section><section class="detail-section"><h3>Plans along the way</h3>${entries.length ? entries.map((a) => `<article class="activity"><span>Day ${number(a.day)}${a.time ? ` · ${e(a.time)}` : ''}</span><p>${e(text(a.title, 'Untitled activity'))}</p>${a.notes ? `<p class="muted small">${e(a.notes)}</p>` : ''}</article>`).join('') : '<p class="muted small">No itinerary activities have been published.</p>'}</section><p class="scroll-note">Budgets are estimates in the mobile app's stored base currency (USD), not live quotes.</p><div class="danger-zone"><div><h3>Remove cloud copy</h3><p>A permanent, audited action.</p></div><button class="text-button danger-text" data-action="delete-trip">${icon('trash')} Delete trip</button></div>`;
}
function packingDetail(d) {
  const items = d.document?.trip?.packing;
  if (!Array.isArray(items)) return empty('Packing data is incomplete.', 'This published copy does not contain a readable packing list.');
  const p = packingProgress(items);
  return `<section class="packing-summary"><p class="eyebrow">PUBLISHED PACKING PROGRESS</p><strong>${p.percent}% ready</strong><p>${number(p.packed)} of ${number(p.total)} units packed · ${number(items.length)} rows</p><progress value="${p.packed}" max="${Math.max(p.total, 1)}" aria-label="Published packing progress"></progress></section>${p.invalid ? '<p class="form-error">Some item quantities are invalid and excluded from this summary.</p>' : ''}<p class="scroll-note">Read-only cloud copy. This may differ from unpublished changes on a traveler's phone.</p><input class="packing-search" id="packing-search" type="search" maxlength="100" value="${e(state.packingQuery)}" placeholder="Find an essential…" aria-label="Search packing items"><div class="packing-filters" role="group" aria-label="Packing status">${[['all', 'All essentials'], ['remaining', 'To pack'], ['packed', 'Packed']].map(([key, label]) => `<button data-packing-filter="${key}" class="${state.packingFilter === key ? 'active' : ''}" aria-pressed="${state.packingFilter === key}">${label}</button>`).join('')}</div><div id="packing-items">${packingItems()}</div>`;
}
function packingItems() {
  const t = state.detail?.document?.trip; if (!t || !Array.isArray(t.packing)) return '';
  const items = filterPacking(t.packing, state.packingQuery, state.packingFilter);
  const categories = Array.isArray(t.packingCategories) ? t.packingCategories : [];
  const people = Array.isArray(t.packingOptions?.people) ? t.packingOptions.people : [];
  return items.length ? items.map((item) => {
    const count = packingCount(item); const category = categories.find((c) => c?.id === item.categoryId)?.name ?? 'Other';
    const owner = item.ownerId === 'shared' ? 'Shared' : people.find((p) => p?.id === item.ownerId)?.name ?? 'Traveler';
    return `<div class="packing-item"><span class="packing-status${count?.complete ? ' packed' : ''}" aria-label="${count?.complete ? 'Packed' : 'Not fully packed'}">${count?.complete ? '✓' : count?.packed ? '·' : ''}</span><div><strong>${e(text(item.label, 'Unnamed item'))}${item.essential ? ' · Essential' : ''}</strong><p>${e(category)} · ${e(owner)}</p>${item.notes ? `<p>${e(item.notes)}</p>` : ''}</div><span class="quantity">${count ? `${count.packed} / ${count.quantity}` : 'Unknown'}</span></div>`;
  }).join('') : empty('A little lighter here.', state.packingQuery || state.packingFilter !== 'all' ? 'No items match these filters.' : 'No packing rows have been published.');
}
function membersDetail(d) { return `<p class="scroll-note">Membership applies to this cloud room. Downloaded local copies remain independent.</p>${d.members?.length ? d.members.map((m) => `<div class="member"><span class="avatar">${e(text(m.email, '?').slice(0, 1).toUpperCase())}</span><div><strong>${e(text(m.email, 'No email address'))}</strong><p class="user-id">${e(m.user_id)}</p></div>${badge(m.role)}</div>`).join('') : empty('No members found.', 'The cloud room currently has no memberships.')}`; }
function openUser(index) {
  const user = state.items[index]; if (!user) return;
  state.editingUser = user;
  const identity = userIdentity(user);
  state.detail = null; state.detailId = null;
  $('#detail-content').innerHTML = `<div class="user-detail"><button class="dialog-close icon-button" data-action="close-detail" aria-label="Close account">×</button><p class="eyebrow">TRAVELER ACCOUNT</p><span class="avatar">${e(identity.initials)}</span><h2 id="detail-title">${e(identity.name || 'Traveler profile')}</h2><p class="muted">${e(identity.email)}</p><div class="badge-row">${badge(user.email_confirmed_at ? 'verified' : 'unconfirmed')}${user.is_admin ? badge('admin') : badge('traveler')}</div><dl class="detail-facts"><div><dt>FULL NAME</dt><dd>${e(identity.name || 'Not provided')}</dd></div><div><dt>HOME CITY</dt><dd>${e(identity.homeCity)}</dd></div><div><dt>ACCOUNT ID</dt><dd class="user-id">${e(user.id)}</dd></div><div><dt>JOINED</dt><dd>${e(date(user.created_at, true))}</dd></div><div><dt>EMAIL CONFIRMED</dt><dd>${e(date(user.email_confirmed_at, true))}</dd></div><div><dt>LAST SIGN-IN</dt><dd>${e(date(user.last_sign_in_at, true))}</dd></div><div><dt>PROFILE UPDATED</dt><dd>${e(date(user.profile_updated_at, true))}</dd></div><div><dt>SHARED TRIPS OWNED</dt><dd>${number(user.shared_trips)}</dd></div><div><dt>CLOUD MEMBERSHIPS</dt><dd>${number(user.memberships)}</dd></div><div><dt>MANUAL ACCOUNT BACKUP</dt><dd>${user.has_backup ? 'Available' : 'Not uploaded'}</dd></div></dl><p class="muted">Profile details are user-provided. Email verification comes from Supabase Auth; administrator access comes only from the protected database allowlist.</p></div>`;
  const facts = $('#detail-content .detail-facts');
  const metadata = document.createElement('details'); metadata.className = 'account-metadata';
  const summary = document.createElement('summary'); summary.textContent = 'Account details';
  facts.before(metadata); metadata.append(summary, facts);
  if (user.profile_updated_at) $('#detail-content .user-detail').insertAdjacentHTML('beforeend', `<form id="profile-form" class="user-form"><h3>The personal details</h3><label for="profile-name">Full name <span class="optional">Optional</span></label><input id="profile-name" name="name" maxlength="100" minlength="2" value="${e(identity.name)}" autocomplete="off" placeholder="Their preferred name"><label for="profile-city">Home city <span class="optional">Optional</span></label><input id="profile-city" name="city" maxlength="100" value="${e(text(user.home_city,''))}" autocomplete="off" placeholder="Their home base"><p class="muted">Changes update this profile only. Email verification and access permissions stay managed separately.</p><p class="form-error" id="profile-error" role="alert"></p><div class="modal-actions"><button type="button" class="button secondary" data-action="close-detail">Cancel</button><button class="button" id="profile-submit" type="submit">Save profile</button></div></form>`);
  const editor = $('#profile-form'); if (editor) metadata.before(editor);
  $('#detail-dialog').showModal();
}
function inviteUserDialog() {
  $('#invite-form').reset(); $('#invite-error').textContent = '';
  const demo = state.source === 'demo';
  $('#invite-status').textContent = demo ? 'DEMO: Adds a local test record only. Use an @example.test address. No account is created and no email is sent.' : state.config?.invitations?.configured ? 'Creates an ordinary traveler account and asks Supabase to send an invitation. Delivery is confirmed by the recipient.' : `Invitations need server configuration: ${state.config?.invitations?.missing?.join(', ') || 'Restart the updated admin server'}. Existing users remain connected.`;
  $('#invite-status').classList.toggle('setup-needed', !demo && !state.config?.invitations?.configured);
  $('#invite-submit').disabled = !demo && !state.config?.invitations?.configured;
  $('#invite-submit').textContent = demo ? 'Add demo user' : 'Send invitation';
  $('#invite-email').placeholder = demo ? 'traveler@example.test' : 'traveler@example.com';
  $('#invite-dialog').showModal();
  $('#invite-email').focus();
}
function setup() {
  $('#setup-status').innerHTML = `<div class="setup-status"><strong>${state.config?.configured ? 'Project configuration is present' : 'Connection is not configured'}</strong><p>${state.config?.configured ? 'The migration and administrator grant are verified after sign-in.' : `Missing: ${e(state.config?.missing?.join(', ') || 'Server connection')}`}</p></div>`;
  $('#setup-dialog').showModal();
}
const mobile = matchMedia('(max-width:760px)');
function closeMenu() { if ($('#sidebar').contains(document.activeElement) && mobile.matches) $('#menu-toggle').focus(); $('#sidebar').classList.remove('open'); $('#sidebar').inert = mobile.matches; $('#mobile-shade').hidden = true; $('#menu-toggle').setAttribute('aria-expanded', 'false'); }
mobile.addEventListener('change', closeMenu); closeMenu();
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button, a'); if (!button || button.disabled) return;
  if (button.matches('.nav-link')) closeMenu();
  if (button.dataset.trip) { void openTrip(button.dataset.trip, button.dataset.tab ?? 'trip'); return; }
  if (button.dataset.user !== undefined) { openUser(Number(button.dataset.user)); return; }
  if (button.dataset.page) { state.page = Number(button.dataset.page); void loadPage(); return; }
  if (button.dataset.detailTab) { state.detailTab = button.dataset.detailTab; renderDetail(); return; }
  if (button.dataset.packingFilter) { state.packingFilter = button.dataset.packingFilter; renderDetail(); return; }
  switch (button.dataset.action) {
    case 'toggle-source':
      if (state.userBusy || state.inviteBusy || state.deleting || !state.config?.demoAvailable) return;
      state.request?.abort(); state.detailRequest?.abort(); state.sequence++;
      $('#detail-dialog').close(); $('#invite-dialog').close(); $('#confirm-dialog').close();
      state.source = state.source === 'demo' ? 'live' : 'demo'; state.items = []; state.query = ''; state.page = 1; state.status = 'all';
      page(); toast(state.source === 'demo' ? 'Demo data only. Supabase records are not changed.' : 'Back to live Supabase data.'); break;
    case 'close-menu': closeMenu(); break;
    case 'setup': setup(); break;
    case 'close-setup': $('#setup-dialog').close(); break;
    case 'refresh': if (!state.config?.configured || !state.user) await bootstrap(); else void loadPage(); break;
    case 'close-detail': if (!state.userBusy) $('#detail-dialog').close(); break;
    case 'invite-user': inviteUserDialog(); break;
    case 'close-invite': if (!state.inviteBusy) $('#invite-dialog').close(); break;
    case 'retry-detail': if (state.detailId) void openTrip(state.detailId, state.detailTab); break;
    case 'clear-filters': state.page = 1; state.query = ''; state.status = 'all'; page(); break;
    case 'clear-search':
      clearTimeout(searchTimer); state.query = ''; state.page = 1; $('#list-search').value = ''; button.hidden = true; $('#list-search').focus(); void loadPage(); break;
    case 'delete-trip':
      $('#delete-form').reset(); $('#delete-error').textContent = ''; $('#delete-description').textContent = state.detail?.summary.title ?? '';
      $('#delete-icon').innerHTML = icon('trash'); $('#confirm-dialog').showModal(); break;
    case 'cancel-delete': if (!state.deleting) $('#confirm-dialog').close(); break;
    case 'logout':
      closeMenu();
      button.disabled = true;
      try { await api('/api/logout', { method: 'POST', body: {} }); state.user = null; state.csrf = null; state.source = 'live'; state.items = []; state.detail = null; page(); toast('Signed out of the admin workspace.'); }
      catch (error) { toast(error.message); if (!state.user) page(); else button.disabled = false; } break;
  }
});
document.addEventListener('submit', async (event) => {
  if (event.target.id === 'profile-form') {
    event.preventDefault(); if (state.userBusy || !state.editingUser) return;
    state.userBusy = true; const user = state.editingUser; const form = event.target; const button = $('#profile-submit');
    const body = { name: form.elements.name.value.trim(), city: form.elements.city.value.trim(), updatedAt: user.profile_updated_at };
    formBusy(form, true); button.textContent = 'Saving…'; $('#profile-error').textContent = '';
    try { await api(`/api/users/${encodeURIComponent(user.id)}/profile`, { method: 'POST', body }); $('#detail-dialog').close(); toast('Profile details saved.'); void loadPage(); }
    catch (error) { if ($('#profile-error')) $('#profile-error').textContent = error.message; }
    finally { state.userBusy = false; if (form.isConnected) { formBusy(form, false); button.textContent = 'Save profile'; } }
  }
  if (event.target.id === 'invite-form') {
    event.preventDefault(); if (state.inviteBusy) return;
    state.inviteBusy = true; const form = event.target; const button = $('#invite-submit');
    const body = { email: form.elements.email.value.trim(), name: form.elements.name.value.trim() };
    formBusy(form, true); button.textContent = 'Requesting invitation…'; $('#invite-error').textContent = '';
    try { const result = await api('/api/users/invite', { method: 'POST', body }); $('#invite-dialog').close(); form.reset(); toast(result.simulated ? 'Demo user added locally. No email was sent.' : 'Supabase accepted the invitation request. Ask the recipient to check their email.'); void loadPage(); }
    catch (error) { $('#invite-error').textContent = error.message; }
    finally { state.inviteBusy = false; formBusy(form, false); button.disabled = state.source !== 'demo' && !state.config?.invitations?.configured; button.textContent = state.source === 'demo' ? 'Add demo user' : 'Send invitation'; }
  }
  if (event.target.id === 'login-form') {
    event.preventDefault(); if (state.loginBusy) return; state.loginBusy = true;
    const form = event.target; const submit = $('#login-submit'); submit.disabled = true; submit.textContent = 'Verifying your access…'; $('#login-error').textContent = '';
    try {
      const result = await api('/api/login', { method: 'POST', body: { email: form.elements.email.value, password: form.elements.password.value } });
      form.reset(); state.user = result.user; state.csrf = result.csrf; state.source = 'live'; state.connectionError = false; page();
    } catch (error) { $('#login-error').textContent = error.message; form.elements.password.value = ''; submit.disabled = false; submit.innerHTML = `Sign in to your workspace ${icon('arrow')}`; }
    finally { state.loginBusy = false; }
  }
  if (event.target.id === 'delete-form') {
    event.preventDefault(); if (state.deleting || !state.detail) return;
    state.deleting = true; $('#delete-submit').disabled = true; $('#delete-submit').textContent = 'Deleting…'; $('#delete-error').textContent = '';
    try {
      await api(`/api/trips/${encodeURIComponent(state.detail.summary.id)}/delete`, { method: 'POST', body: { revision: state.detail.summary.revision, confirmation: $('#delete-confirmation').value, reason: $('#delete-reason').value } });
      $('#confirm-dialog').close(); $('#detail-dialog').close(); toast('Shared trip deleted. Mobile copies remain on their devices.'); void loadPage();
    } catch (error) { $('#delete-error').textContent = error.message; }
    finally { state.deleting = false; $('#delete-submit').disabled = false; $('#delete-submit').textContent = 'Delete shared journey'; }
  }
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'list-search') { state.query = event.target.value; state.page = 1; const clear = $('.search-clear'); if (clear) clear.hidden = !state.query; clearTimeout(searchTimer); searchTimer = setTimeout(() => void loadPage(), 350); }
  if (event.target.id === 'packing-search') { state.packingQuery = event.target.value; $('#packing-items').innerHTML = packingItems(); }
});
$('#main').addEventListener('change', (event) => { if (event.target.id === 'status-filter') { state.status = event.target.value; state.page = 1; void loadPage(); } });
$('#detail-dialog').addEventListener('close', () => { state.detailRequest?.abort(); state.detail = null; state.detailId = null; state.editingUser = null; $('#detail-content').innerHTML = ''; });
$('#detail-dialog').addEventListener('cancel', (event) => { if (state.userBusy) event.preventDefault(); });
$('#invite-dialog').addEventListener('cancel', (event) => { if (state.inviteBusy) event.preventDefault(); });
$('#confirm-dialog').addEventListener('cancel', (event) => { if (state.deleting) event.preventDefault(); });
$('#menu-toggle').addEventListener('click', () => { const open = $('#sidebar').classList.toggle('open'); $('#sidebar').inert = !open; $('#mobile-shade').hidden = !open; $('#menu-toggle').setAttribute('aria-expanded', String(open)); if (open) $('#sidebar').querySelector('button').focus(); });
$('#mobile-shade').addEventListener('click', closeMenu);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
  if (event.key === 'Tab' && mobile.matches && $('#sidebar').classList.contains('open') && !document.querySelector('dialog[open]')) {
    const controls = [...$('#sidebar').querySelectorAll('a,button')].filter((v) => !v.disabled);
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  }
});
function navigate() { const route = location.hash.slice(1); state.route = Object.hasOwn(titles, route) ? route : 'overview'; state.page = 1; state.query = ''; state.status = 'all'; clearTimeout(searchTimer); if ($('#detail-dialog').open) $('#detail-dialog').close(); page(); }
window.addEventListener('hashchange', () => { if (location.hash !== '#main') navigate(); });
async function bootstrap() {
  state.request?.abort();
  try {
    state.config = await api('/api/config');
    if (state.config.configured) {
      try { const session = await api('/api/session'); state.user = session.user; state.csrf = session.csrf; }
      catch (error) { state.user = null; state.csrf = null; navigate(); $('#login-error').textContent = error.message; return; }
    } else { state.user = null; state.csrf = null; }
    state.connectionError = false; navigate();
  } catch (error) {
    state.connectionError = true; chrome();
    $('#main').innerHTML = `<section class="card">${empty('Your workspace is taking a moment.', error.message, 'Retry connection', 'refresh')}</section>`;
  }
}
void bootstrap();
