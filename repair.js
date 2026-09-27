// repair.js：版本对齐原语（不改动入参，返回新表）
export function fixPair(pairs, key) {
  let fixed = false;
  const next = pairs.map(function (row) {
    if (row[0] !== key || row[1] === row[2]) return [row[0], row[1], row[2]];
    fixed = true;
    const version = Math.max(row[1], row[2]);
    return [row[0], version, version];
  });
  return { pairs: next, fixed: fixed };
}

export function alignedOf(pairs) {
  return pairs
    .filter(function (row) { return row[1] === row[2]; })
    .map(function (row) { return row[0]; })
    .sort();
}
