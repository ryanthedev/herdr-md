// node --test test/
// Inline references (mods/herdr-md/doc.js inlineRoles): footnotes and d2l roles
// become links the viewer follows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inlineRoles } from "../mods/herdr-md/doc.js";

test("a footnote reference links to its definition by number", () => {
  const labels = new Map([["^1", { block: 40, num: 1 }], ["^bergomi", { block: 41, num: 12 }]]);
  assert.equal(inlineRoles("Schadner [^1] and Bergomi [^bergomi].", labels),
    "Schadner[¹](#label:%5E1) and Bergomi[¹²](#label:%5Ebergomi).");
});

test("an undefined footnote and a definition marker stay as written", () => {
  assert.equal(inlineRoles("missing [^9]; [^1]: text", new Map([["^1", { block: 3, num: 1 }]])), "missing [^9]; [^1]: text");
});

test("a reference inside a code span stays as written", () => {
  assert.equal(inlineRoles("see `a [^1]` and x [^1]", new Map([["^1", { block: 3, num: 1 }]])), "see `a [^1]` and x[¹](#label:%5E1)");
});
