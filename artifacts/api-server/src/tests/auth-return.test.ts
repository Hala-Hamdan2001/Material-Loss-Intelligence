import assert from "node:assert/strict";
import { getSafeReturnTo } from "../lib/auth-return";

for (const value of [undefined, [], "", "https://attacker.example", "//attacker.example",
  "/\\attacker.example", "/\\\\attacker.example", "/\t/attacker.example",
  "/\n/attacker.example", "/jobs\r\nLocation: https://attacker.example"]) {
  assert.equal(getSafeReturnTo(value), "/");
}
for (const value of ["/", "/jobs", "/jobs?search=IK-202", "/settings", "/jobs?search=%D8%B9"]) {
  assert.equal(getSafeReturnTo(value), value);
}
console.log("15 return-path cases passed.");
