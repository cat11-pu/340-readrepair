import { fixPair, alignedOf } from "./repair.js";

function codeOf(spec, fallback, override) {
  const value = spec && override ? spec[override] : null;
  return typeof value === "string" && value.length ? value : fallback;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isBadEvent(event) {
  if (event === null || typeof event !== "object") return true;
  if (event.kind !== "fix") return true;
  if (typeof event.key !== "string" || event.key.length === 0) return true;
  return false;
}

function cloneState(state) {
  return {
    pairs: state.pairs.map(function (row) { return [row[0], row[1], row[2]]; }),
    aligned: state.aligned.slice(),
    fixes: state.fixes,
    ledger: state.ledger.map(function (row) { return [row[0], row[1]]; }),
    applied: state.applied.slice()
  };
}

function findRow(pairs, key) {
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][0] === key) return i;
  }
  return -1;
}

function insertSorted(list, key) {
  if (list.indexOf(key) !== -1) return;
  let lo = 0, hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < key) lo = mid + 1; else hi = mid;
  }
  list.splice(lo, 0, key);
}

// 对一条修复事件落到当前状态上：抬版本、计数、记账。
function applyFix(spec, state, key) {
  const index = findRow(state.pairs, key);
  if (index === -1) {
    throw fail(codeOf(spec, "E_NO_KEY", "key_error_code"), "键不在版本表里：" + key);
  }
  if (state.pairs[index][1] === state.pairs[index][2]) {
    throw fail(codeOf(spec, "E_ALREADY_ALIGNED", "aligned_error_code"),
               "键两侧版本已经一样：" + key);
  }
  const result = fixPair(state.pairs, key);
  state.pairs = result.pairs;
  if (result.fixed) {
    state.fixes += 1;
    insertSorted(state.aligned, key);
  }
}

export function step(spec) {
  const state = cloneState(spec.state);
  const events = spec.events || [];
  const budget = typeof spec.budget === "number" && isFinite(spec.budget)
    ? Math.max(0, Math.floor(spec.budget)) : 0;

  // 先做结构校验：与预算无关，结构不合法立刻报。
  for (let i = 0; i < events.length; i++) {
    if (isBadEvent(events[i])) {
      throw fail(codeOf(spec, "E_BAD_EVENT", "event_error_code"),
                 "事件结构不合法：" + String(events[i] && events[i].id));
    }
  }

  let served = 0;
  let judged = 0;
  let remaining = budget;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    // 已处理集合命中的键直接跳过，不占预算、不压账。
    if (state.applied.indexOf(event.key) !== -1) continue;
    if (remaining <= 0) {
      // 预算用尽：事件连着载压账带出下一轮。
      state.ledger.push([event.kind, event.key]);
      continue;
    }
    judged += 1;
    remaining -= 1;
    applyFix(spec, state, event.key);
    served += 1;
    insertSorted(state.applied, event.key);
  }

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return [row[0], row[1]]; }),
    judged: judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  let catchup = 0;
  while (state.ledger.length) {
    const entry = state.ledger.shift();
    if (!entry || entry[0] !== "fix") {
      throw fail(codeOf(spec, "E_BAD_EVENT", "event_error_code"), "账上事件不合法");
    }
    applyFix(spec, state, entry[1]);
    catchup += 1;
    insertSorted(state.applied, entry[1]);
  }
  return { state: state, catchup: catchup };
}
