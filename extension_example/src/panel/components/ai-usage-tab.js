// ============================================================
// AI Usage Tab — honest, minimal reporting of AI-request activity.
// Three cards:
//   - This session: totals since SW start / last clear
//   - Today: request counts per provider (UTC day)
//   - Last 30 days: aggregated requests + est. cost
// Plus the existing per-provider rate-limit block (relocated from
// the Provider tab) when headers are available.
//
// Contract with the user (surfaced in the tab footer):
//   - Token counts come from the provider response — authoritative.
//   - Estimated cost is OUR computation (tokens × hardcoded rate
//     table in shared/ai/ai-provider.js). Always labeled "est."
//   - Rate limits come from provider headers (Anthropic, OpenAI).
//     Gemini returns none, so its "Today" row is a local count.
// ============================================================

import { listProviders } from '../../shared/ai/ai-provider.js';

let _deps;
let _initialized = false;

export function initAiUsageTab(deps) {
  _deps = deps;
  _initialized = true;
  renderShell();
  refresh();
}

/**
 * Re-render the tab. Called by panel.js after every AI request so the
 * three cards stay fresh if the tab is open.
 */
export function refreshAiUsageTab() {
  if (!_initialized) return;
  refresh();
}

function container() {
  return _deps?.elements?.aiTabUsage
    || document.getElementById('ai-tab-usage');
}

function providerDisplayName(id) {
  const p = listProviders().find((pr) => pr.id === id);
  return p?.shortName || id;
}

function renderShell() {
  const el = container();
  if (!el) return;
  el.replaceChildren();
  el.insertAdjacentHTML('afterbegin', `
    <section class="ai-section">
      <div class="ai-usage-cards">
        <div class="ai-usage-card" id="ai-usage-card-session">
          <h4 class="ai-usage-title">This session</h4>
          <div class="ai-usage-card-body" id="ai-usage-card-session-body"></div>
        </div>
        <div class="ai-usage-card" id="ai-usage-card-today">
          <h4 class="ai-usage-title">Today</h4>
          <div class="ai-usage-card-body" id="ai-usage-card-today-body"></div>
        </div>
        <div class="ai-usage-card" id="ai-usage-card-30d">
          <h4 class="ai-usage-title">Last 30 days</h4>
          <div class="ai-usage-card-body" id="ai-usage-card-30d-body"></div>
        </div>
      </div>
      <div class="ai-usage-limits" id="ai-usage-limits"></div>
      <p class="ai-usage-footnote">
        <strong>Token counts</strong> are returned by the provider on every request.
        <strong>Est. cost</strong> is computed locally from the token counts and a
        built-in price list — it is an estimate, not a bill. For authoritative
        usage and invoices, visit your provider's console.
      </p>
    </section>
  `);
}

async function refresh() {
  let snapshot = null;
  try {
    const result = _deps.getAiUsage?.();
    snapshot = result && typeof result.then === 'function' ? await result : result;
  } catch {
    snapshot = null;
  }
  if (!snapshot) return;

  renderSessionCard(snapshot.sessionTotals);
  renderTodayCard(snapshot.dailyCounts);
  renderLast30Card(snapshot.last30Days);
  renderLimitsBlock(snapshot.perProvider);
}

function fmtInt(n) {
  return Number(n || 0).toLocaleString();
}

function fmtCost(n) {
  const v = Number(n || 0);
  if (v === 0) return '$0.00';
  if (v < 0.01) return `<$0.01`;
  return `$${v.toFixed(2)}`;
}

function setCardBody(id, rows) {
  const body = document.getElementById(id);
  if (!body) return;
  body.replaceChildren();
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'ai-usage-empty';
    p.textContent = 'No activity yet.';
    body.appendChild(p);
    return;
  }
  const dl = document.createElement('dl');
  dl.className = 'ai-usage-dl';
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    dl.append(dt, dd);
  }
  body.appendChild(dl);
}

function renderSessionCard(totals) {
  const rows = [];
  if (totals?.requests > 0) {
    rows.push(['Requests', fmtInt(totals.requests)]);
    rows.push(['Tokens in', fmtInt(totals.tokensIn)]);
    rows.push(['Tokens out', fmtInt(totals.tokensOut)]);
    rows.push(['Est. cost', fmtCost(totals.costEstimate)]);
  }
  setCardBody('ai-usage-card-session-body', rows);
}

function renderTodayCard(daily) {
  const counts = daily?.counts || {};
  const entries = Object.entries(counts).filter(([, n]) => (Number(n) || 0) > 0);
  const rows = entries.map(([provider, n]) => [providerDisplayName(provider), `${fmtInt(n)} req`]);
  setCardBody('ai-usage-card-today-body', rows);
}

function renderLast30Card(last30) {
  const totals = last30?.totals;
  const rows = [];
  if (totals?.requests > 0) {
    rows.push(['Requests', fmtInt(totals.requests)]);
    rows.push(['Tokens in', fmtInt(totals.tokensIn)]);
    rows.push(['Tokens out', fmtInt(totals.tokensOut)]);
    rows.push(['Est. cost', fmtCost(totals.costEstimate)]);
  }
  setCardBody('ai-usage-card-30d-body', rows);

  // Only show per-provider breakdown when more than one provider has
  // actually been used in the window — otherwise it's noise.
  const per = last30?.perProvider || {};
  const activeProviders = Object.entries(per).filter(([, b]) => (Number(b?.requests) || 0) > 0);
  if (activeProviders.length < 2) return;

  const body = document.getElementById('ai-usage-card-30d-body');
  if (!body) return;
  const divider = document.createElement('div');
  divider.className = 'ai-usage-subhead';
  divider.textContent = 'By provider';
  body.appendChild(divider);

  const ul = document.createElement('ul');
  ul.className = 'ai-usage-provider-list';
  for (const [providerId, bucket] of activeProviders) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'ai-usage-provider-name';
    name.textContent = providerDisplayName(providerId);
    const stats = document.createElement('span');
    stats.className = 'ai-usage-provider-stats';
    stats.textContent = `${fmtInt(bucket.requests)} req · ${fmtCost(bucket.costEstimate)}`;
    li.append(name, stats);
    ul.appendChild(li);
  }
  body.appendChild(ul);
}

function renderLimitsBlock(perProvider) {
  const box = document.getElementById('ai-usage-limits');
  if (!box) return;
  box.replaceChildren();

  const withLimits = Object.entries(perProvider || {})
    .filter(([, snap]) => snap?.rateLimits);

  if (withLimits.length === 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;

  const title = document.createElement('h4');
  title.className = 'ai-usage-title';
  title.textContent = 'Provider limits (last response)';
  box.appendChild(title);

  for (const [providerId, snap] of withLimits) {
    const providerHead = document.createElement('div');
    providerHead.className = 'ai-usage-subhead';
    providerHead.textContent = providerDisplayName(providerId);
    box.appendChild(providerHead);

    const limits = snap.rateLimits;
    appendBucketRow(box, 'Requests', limits.requests);
    appendBucketRow(box, 'Tokens', limits.tokens);
    appendBucketRow(box, 'Input tokens', limits.inputTokens);
    appendBucketRow(box, 'Output tokens', limits.outputTokens);
  }
}

function appendBucketRow(container, label, bucket) {
  if (!bucket) return;
  const row = document.createElement('div');
  row.className = 'ai-usage-limit-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'ai-usage-limit-label';
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const valueEl = document.createElement('span');
  valueEl.className = 'ai-usage-limit-value';
  const remaining = bucket.remaining;
  const limit = bucket.limit;
  if (remaining != null && limit != null) {
    valueEl.textContent = `${formatShort(remaining)} / ${formatShort(limit)} left`;
    if (limit > 0 && remaining / limit < 0.1) {
      valueEl.classList.add('ai-usage-limit-value--low');
    }
  } else if (remaining != null) {
    valueEl.textContent = `${formatShort(remaining)} left`;
  } else if (limit != null) {
    valueEl.textContent = `${formatShort(limit)} cap`;
  } else {
    valueEl.textContent = '—';
  }
  row.appendChild(valueEl);

  if (bucket.resetAt) {
    const reset = document.createElement('span');
    reset.className = 'ai-usage-limit-reset';
    reset.textContent = describeReset(bucket.resetAt);
    row.appendChild(reset);
  }
  container.appendChild(row);
}

function formatShort(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function describeReset(resetAtMs) {
  const ms = resetAtMs - Date.now();
  if (ms <= 0) return 'resets now';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `resets in ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `resets in ${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `resets in ${hr}h`;
  const day = Math.round(hr / 24);
  return `resets in ${day}d`;
}
