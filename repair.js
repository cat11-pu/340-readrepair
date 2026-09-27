// repair.js：版本对齐（读修复）
// fixPair：把键两侧版本抬到较大者；fixed 表示这次是否真的发生过修复。
// 不改动入参，返回新的版本表。
export function fixPair(pairs, key) {
  let fixed = false;
  const next = pairs.map(function (row) {
    const k = row[0], left = row[1], right = row[2];
    if (k === key) {
      const version = Math.max(left, right);
      fixed = left !== right;
      return [k, version, version];
    }
    return [k, left, right];
  });
  return { pairs: next, fixed: fixed };
}

// alignedOf：两侧版本已经一样的键，按名字升序。
export function alignedOf(pairs) {
  return pairs
    .filter(function (row) { return row[1] === row[2]; })
    .map(function (row) { return row[0]; })
    .sort();
}
