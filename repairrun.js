// repairrun.js：按处理预算处理修复事件，超出预算连着载压账，收尾不限预算清账。
import { fixPair } from "./repair.js";

function errorCode(spec, key, fallback) {
  return (spec && spec[key]) || fallback;
}

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// 结构合法性：必须是带 kind === "fix" 且 key 为字符串的对象；与预算无关，先整批校验。
function isFixEvent(event) {
  return event !== null && typeof event === "object" && !Array.isArray(event)
    && event.kind === "fix" && typeof event.key === "string";
}

// 跨轮状态深拷贝，保证同一 spec 反复重放互不污染。
function cloneState(state) {
  return {
    pairs: state.pairs.map(function (row) { return [row[0], row[1], row[2]]; }),
    aligned: state.aligned.slice(),
    fixes: state.fixes,
    ledger: state.ledger.map(function (row) { return [row[0], row[1]]; }),
    applied: state.applied.slice()
  };
}

function findPair(pairs, key) {
  return pairs.find(function (row) { return row[0] === key; }) || null;
}

function noteAligned(aligned, key) {
  if (aligned.indexOf(key) === -1) aligned.push(key);
  aligned.sort();
}

// 对一条事件做语义判定与修复；返回 false 表示该键已处理过（重放空操作）。
function repairOne(state, kind, key, spec) {
  const row = findPair(state.pairs, key);
  if (!row) throw makeError(errorCode(spec, "key_error_code", "E_NO_KEY"), "键不在版本表里：" + key);
  if (state.applied.indexOf(key) !== -1) return false;
  if (row[1] === row[2]) {
    throw makeError(errorCode(spec, "aligned_error_code", "E_ALREADY_ALIGNED"), "两侧版本已经一样：" + key);
  }
  const result = fixPair(state.pairs, key);
  state.pairs = result.pairs;
  state.fixes += 1;
  noteAligned(state.aligned, key);
  state.applied.push(key);
  return true;
}

export function step(spec) {
  const events = spec.events || [];

  // 先校验事件结构，不合法直接抛错，与预算无关。
  events.forEach(function (event) {
    if (!isFixEvent(event)) {
      throw makeError(errorCode(spec, "event_error_code", "E_BAD_EVENT"), "事件结构不合法");
    }
  });

  const state = cloneState(spec.state);
  let budget = Number.isFinite(spec.budget) ? Math.max(0, Math.trunc(spec.budget)) : 0;

  // 旧账先进先出，再接本轮新事件。
  const queue = state.ledger
    .map(function (row) { return { kind: row[0], key: row[1] }; })
    .concat(events.map(function (event) { return { kind: event.kind, key: event.key }; }));
  state.ledger = [];

  let served = 0;
  let judged = 0;
  queue.forEach(function (item) {
    if (budget <= 0) {
      state.ledger.push([item.kind, item.key]);
      return;
    }
    judged += 1;
    budget -= 1;
    if (repairOne(state, item.kind, item.key, spec)) served += 1;
  });

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return [row[0], row[1]]; }),
    judged: judged,
    judged_bound: queue.length
  };
}

// 收尾：不限预算，把账上压着的事件全部处理完，返回补齐（实际修复）条数。
export function close(spec) {
  const state = cloneState(spec.state);
  let catchup = 0;
  state.ledger.forEach(function (row) {
    if (repairOne(state, row[0], row[1], spec)) catchup += 1;
  });
  state.ledger = [];
  return { state: state, catchup: catchup };
}
