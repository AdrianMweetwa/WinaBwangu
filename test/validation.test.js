const test = require("node:test");
const assert = require("node:assert/strict");
const { isFiniteNumber, isPositiveInteger } = require("../backend/utils/validation");

test("numeric validators reject nonnumeric values instead of coercing them", () => {
  for (const value of [null, undefined, true, false, "", " ", [], [1], {}, NaN, Infinity, -Infinity, "NaN", "Infinity"]) {
    assert.equal(isFiniteNumber(value), false, `finite: ${String(value)}`);
    assert.equal(isPositiveInteger(value), false, `integer: ${String(value)}`);
  }
});

test("numeric validators preserve numeric strings and enforce boundaries", () => {
  for (const value of [1, "1", " 2 "]) assert.equal(isPositiveInteger(value), true);
  for (const value of [0, -1, 1.5, "1.5"]) assert.equal(isPositiveInteger(value), false);
  for (const value of [0, "0", 2, "2", 1.5]) assert.equal(isFiniteNumber(value, { min: 0, max: 2 }), true);
  for (const value of [-0.01, 2.01]) assert.equal(isFiniteNumber(value, { min: 0, max: 2 }), false);
});
