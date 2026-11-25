// node test/link.test.mjs
// Terminal link handling: which path a click means, and which viewer shows it.
// Files are real (a temporary folder); Herdr's functions are stand-ins.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openLink } from "../mods/herdr-md/link-open.js";

let n = 0;
const t = async (name, f) => { await f(); n++; console.log("ok  ", name); };

const root = realpathSync(mkdtempSync(join(tmpdir(), "herdr-md-link-")));
const proj = `${root}/proj`, home = `${root}/home`;
const put = path => { mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true }); writeFileSync(path, "# t\n"); };
for (const f of ["docs/a.md", "docs/b.markdown", "docs/c.MDX", "docs/x.png", "docs/odd:1.md"]) put(`${proj}/${f}`);
put(`${home}/.agent/plan.md`);
put(`${root}/outside dir/é #1.md`);
put(`${root}/real/deep/inner.md`); put(`${root}/real/up.md`);
mkdirSync(`${proj}/docs/folder.md`);
symlinkSync(`${root}/real/deep`, `${proj}/link`);

const source = { terminal: "t1", machine: null, cwd: proj, pane: "pT", tab: "tb", space: "sp" };
async function click(raw, { path = null, from = source, panes = [] } = {}) {
  const sent = [];
  const result = await openLink({ link: { kind: "file", raw, path }, source: from }, {
    exec: (cmd, args) => new Promise(ok => execFile(cmd, args, (e, stdout, stderr) => ok({ code: e ? e.code : 0, stdout, stderr }))),
    home: () => home,
    notify: note => sent.push(["notify", note.body]),
    panes: () => panes,
    run: (name, args) => sent.push([name, args]),
    setShared: (key, value) => sent.push(["setShared", key, value]),
  });
  return { result, sent };
}
async function opens(raw, file, options) {
  const { result, sent } = await click(raw, options);
  assert.equal(result, "handled", raw);
  assert.deepEqual(sent, [["pane.split", { direction: "right", mod: "herdr-md", props: { file, machine: null }, pane: "pT" }]], raw);
}
const viewer = (pane, extra) => ({ pane, tab: "tb", mod: "herdr-md", zoomed: false, ...extra });
const names = sent => sent.map(s => s[0]);

try {
  await t("absolute, relative and ~/ paths; .md, .markdown and .mdx", async () => {
    await opens(`${proj}/docs/a.md`, `${proj}/docs/a.md`);
    await opens("docs/a.md", `${proj}/docs/a.md`);
    await opens("./docs/b.markdown", `${proj}/docs/b.markdown`);
    await opens("docs/c.MDX", `${proj}/docs/c.MDX`);
    await opens("~/.agent/plan.md", `${home}/.agent/plan.md`);
    await opens("$HOME/.agent/plan.md", `${home}/.agent/plan.md`);
    await opens("$PWD/docs/a.md", `${proj}/docs/a.md`);
    await opens("../docs/a.md", `${proj}/docs/a.md`, { from: { ...source, cwd: `${proj}/docs` } });
  });
  await t("trailing punctuation, positions and anchors", async () => {
    for (const tail of [".", "...", ",", ":", ";", "!", "?", ")", "]", "**", "`", '"', ").", ":12", ":12:3", ":5-12", "#L5-L12", "#section", ":12."])
      await opens(`docs/a.md${tail}`, `${proj}/docs/a.md`);
  });
  await t("a literal ':' or '#' in a file name wins", async () => {
    await opens("docs/odd:1.md", `${proj}/docs/odd:1.md`);
    await opens(`${root}/outside dir/é #1.md`, `${root}/outside dir/é #1.md`);
  });
  await t("file: URIs, percent-encoded, outside the project", async () => {
    const encoded = encodeURI(`${root}/outside dir/`) + "%C3%A9%20%231.md";
    for (const raw of [`file://${encoded}`, `file://localhost${encoded}#L12`, `file:${encoded}`]) await opens(raw, `${root}/outside dir/é #1.md`);
  });
  await t("'..' follows a symlinked folder as the file system does", async () => {
    await opens("link/../up.md", `${root}/real/up.md`);
  });
  await t("Herdr's verified path is used", async () => {
    await opens("whatever.md", `${proj}/docs/a.md`, { path: `${proj}/docs/a.md` });
  });
  await t("the tab's only viewer is reused", async () => {
    const { sent } = await click("docs/a.md", { panes: [viewer("v1")] });
    assert.deepEqual(sent, [["setShared", "herdr-md.open", { file: `${proj}/docs/a.md` }], ["herdr-md.open", undefined]]);
  });
  await t("a viewer in another tab is left alone", async () => {
    assert.deepEqual(names((await click("docs/a.md", { panes: [viewer("v1", { tab: "other" })] })).sent), ["pane.split"]);
  });
  await t("with several viewers it opens another and closes none", async () => {
    assert.deepEqual(names((await click("docs/a.md", { panes: [viewer("v1"), viewer("v2")] })).sent), ["pane.split"]);
  });
  await t("a zoomed terminal is unzoomed first; a zoomed viewer stays", async () => {
    const hidden = await click("docs/a.md", { panes: [{ pane: "pT", tab: "tb", zoomed: true }, viewer("v1")] });
    assert.deepEqual(names(hidden.sent), ["pane.zoom", "setShared", "herdr-md.open"]);
    assert.deepEqual(names((await click("docs/a.md", { panes: [viewer("v1", { zoomed: true })] })).sent), ["setShared", "herdr-md.open"]);
  });
  await t("a click with no source pane splits the focused one", async () => {
    const { sent } = await click("docs/a.md", { from: { ...source, pane: null, tab: null } });
    assert.ok(!("pane" in sent[0][1]));
  });
  await t("remote terminals, other hosts and other files pass", async () => {
    for (const [raw, from] of [["docs/a.md", { ...source, machine: "vps" }], ["file://other-host/a.md", source], ["docs/x.png", source], ["docs/a.md", { ...source, cwd: null }]])
      assert.deepEqual(await click(raw, { from }), { result: "pass", sent: [] }, raw);
    assert.equal(await openLink({ link: { kind: "url", raw: "https://x.dev/README.md" }, source }, {}), "pass");
  });
  await t("a missing file or a folder says so and opens nothing", async () => {
    for (const raw of ["docs/missing.md", "docs/folder.md"]) assert.deepEqual(names((await click(raw)).sent), ["notify"], raw);
  });
  await t("mod.json's rule", () => {
    const [rule] = JSON.parse(readFileSync(new URL("../mods/herdr-md/mod.json", import.meta.url))).link_handlers;
    assert.equal(rule.kind, "file");
    const pattern = new RegExp(rule.pattern.replace("(?i)", ""), "i");
    for (const s of ["a/b.md", "b.markdown", "c.MDX", "a.md!", "a.md**", "a.md#sec", "a.md?x"]) assert.ok(pattern.test(s), s);
    for (const s of ["a.png", "a.mdc", "a.md/x.txt", "a.md.bak", "md"]) assert.ok(!pattern.test(s), s);
  });
} finally { rmSync(root, { recursive: true, force: true }); }
console.log(`${n} tests passed`);
