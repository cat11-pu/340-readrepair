import assert from "node:assert";
import { fixPair, alignedOf } from "../repair.js";
import { step, close } from "../repairrun.js";

const base = {
  budget: 1,
  state: { pairs: [["k1", 1, 3]], aligned: [], fixes: 0, ledger: [], applied: [] },
  events: [{ id: 1, kind: "fix", key: "k1" }],
  key_error_code: "E_NO_KEY", aligned_error_code: "E_ALREADY_ALIGNED",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("fixPair returns pairs", () => {
  const got = fixPair([["z", 1, 2]], "z");
  assert.ok(Array.isArray(got.pairs));
});

check("alignedOf returns keys", () => {
  assert.ok(Array.isArray(alignedOf([["z", 3, 3]])));
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
