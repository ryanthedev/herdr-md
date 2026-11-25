// Herdr's terminal link handler (Ctrl-click, or Cmd-click on macOS). The logic
// is in link-open.js, which takes these as arguments so Node can test it.
import { exec, home, notify, panes, run, setShared } from "herdr";
import { openLink } from "./link-open.js";

export const handleLink = click => openLink(click, { exec, home, notify, panes, run, setShared });
