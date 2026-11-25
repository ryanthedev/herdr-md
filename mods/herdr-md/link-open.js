// A clicked Markdown path in a terminal: find the file and show it in a viewer
// to the right, reusing the tab's viewer. No Herdr imports (see link.js).

const VIEWER = "herdr-md";
const MARKDOWN = /\.(md|markdown|mdx)$/i;
// What sentences, quotes and Markdown emphasis leave after a path.
const TRAILING = /[.,:;!?*#'"`)\]}>]+$/;
// `#anchor`, `?query`, `:line[:column]` or `:start-end` after the extension.
const PLACE = /(\.(?:md|markdown|mdx))(?:[#?][^/]*|(?::L?\d+(?:-L?\d+)?){1,2})$/i;

// The path in a file: URI, or null when it names another host.
function fromFileUri(uri) {
  let rest = uri.slice("file:".length);
  if (rest.startsWith("//")) {
    const slash = rest.indexOf("/", 2);
    if (slash < 0 || !["", "localhost"].includes(rest.slice(2, slash).toLowerCase())) return null;
    rest = rest.slice(slash);
  }
  // Query and anchor go before decoding, so an escaped %23 stays in the name.
  try { return decodeURIComponent(rest.split(/[?#]/)[0]); } catch { return null; }
}

function absolute(path, cwd, home) {
  let full;
  if (path.startsWith("~/")) full = `${home}/${path.slice(2)}`;
  else if (path.startsWith("$HOME/")) full = `${home}/${path.slice(6)}`;
  else if (path.startsWith("/")) full = path;
  else if (!cwd) return null;
  else full = `${cwd}/${path.startsWith("$PWD/") ? path.slice(5) : path}`;
  // `..` is left for realpath: removing it as text is wrong across symlinks.
  return full.replace(/\/(?:\.\/)+/g, "/").replace(/\/{2,}/g, "/");
}

// The local paths a file link may mean, best guess first. Herdr's `link.path` is
// null when its own reading of the text names no file, e.g. "notes.md!".
export function candidates(link, cwd, home) {
  const spelled = /^file:/i.test(link.raw) ? fromFileUri(link.raw) : link.raw;
  if (spelled === null) return [];
  const bare = spelled.replace(TRAILING, "");
  // The literal spelling first: `#` or `:` can be part of a real file name.
  const spellings = [spelled, bare, bare.replace(PLACE, "$1"), spelled.replace(PLACE, "$1").replace(TRAILING, "")];
  const paths = [link.path, ...spellings.map(s => absolute(s, cwd, home))];
  return [...new Set(paths.filter(p => p && MARKDOWN.test(p)))];
}

async function firstFile(paths, exec) {
  for (const path of paths) {
    if ((await exec("test", ["-f", path])).code !== 0) continue;
    if (!path.includes("/../")) return path;
    const real = await exec("realpath", [path]);
    return real.code === 0 ? real.stdout.replace(/\n$/, "") : path;
  }
  return null;
}

function show(file, source, { panes, run, setShared }) {
  const here = source.tab ? panes().filter(p => p.tab === source.tab) : [];
  // A zoomed pane hides the others: end the zoom so the document can be seen.
  const zoomed = here.find(p => p.zoomed);
  if (zoomed && zoomed.mod !== VIEWER) run("pane.zoom", { pane: zoomed.pane });
  // herdr-md.open works when the tab has exactly one viewer. With several it
  // can't say which, so the click opens another and closes none.
  if (here.filter(p => p.mod === VIEWER).length === 1) {
    setShared("herdr-md.open", { file });
    run("herdr-md.open");
    return;
  }
  const args = { direction: "right", mod: VIEWER, props: { file, machine: null } };
  if (source.pane) args.pane = source.pane;
  run("pane.split", args);
}

// "handled", or "pass" for Herdr to try the next handler or its own opener.
export async function openLink({ link, source }, host) {
  // A remote terminal's files aren't on this computer: leave those clicks alone.
  if (link.kind !== "file" || source.machine) return "pass";
  const paths = candidates(link, source.cwd, host.home());
  if (!paths.length) return "pass";
  const file = await firstFile(paths, host.exec);
  if (file) show(file, source, host);
  else host.notify({ title: "herdr-md: file not found", body: paths[0], level: "warning" });
  return "handled";
}
