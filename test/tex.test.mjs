// node --test test/
// Inline math as Unicode (mods/herdr-md/tex.js): plain $…$, GitHub's protected
// $`…`$, and $$…$$ inside a sentence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { inlineMath, splitInline } from "../mods/herdr-md/tex.js";

test("each inline math syntax becomes italic Unicode", () => {
  assert.equal(inlineMath("a $\\sigma^2 T$ b"), "a *σ² T* b");
  assert.equal(inlineMath("a $`\\sigma^2 T`$ b"), "a *σ² T* b");
  assert.equal(inlineMath("a $$(v_0, \\theta, \\kappa)$$ b"), "a *(v₀, θ, κ)* b");
});

test("prices stay text", () => {
  assert.equal(inlineMath("book the $5 and $10 ones"), "book the $5 and $10 ones");
});

test("portable-math macros convert", () => {
  assert.equal(inlineMath("$`k = \\ln(K/F)`$"), "*k = ln(K/F)*");
  assert.equal(inlineMath("$`\\tfrac{1}{2}\\thinspace x`$"), "*1/2 x*");
  assert.equal(inlineMath("$`\\lbrace X\\diamond M \\rbrace`$"), "*{ X⋄ M }*");
  assert.equal(inlineMath("$`\\lvert x\\rvert \\ll \\lVert y\\rVert`$"), "*| x| ≪ ‖ y‖*");
});

test("text splits around each inline formula", () => {
  assert.deepEqual(splitInline("a $`x_1`$ b $$y$$ c $5 and $10"),
    [{ text: "a " }, { tex: "x_1" }, { text: " b " }, { tex: "y" }, { text: " c $5 and $10" }]);
});

test("double-dollar prices stay text", () => {
  assert.equal(inlineMath("cost $$5 and $$10"), "cost $$5 and $$10");
});

test("separate code spans inside dollar signs stay as code", () => {
  const md = "($`x` `y`$)";
  assert.equal(inlineMath(md), md);
  assert.deepEqual(splitInline(md), [{ text: md }]);
});

test("protected math uses the first backtick run of the opening length", () => {
  const md = "($``x` + y``$)";
  assert.equal(inlineMath(md), "(*x` + y*)");
  assert.deepEqual(splitInline(md), [{ text: "(" }, { tex: "x` + y" }, { text: ")" }]);
});

test("an unfinished protected delimiter leaves a later formula intact", () => {
  assert.equal(inlineMath("Unfinished $`x` and $y$."), "Unfinished $`x` and *y*.");
});
