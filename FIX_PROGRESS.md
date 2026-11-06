# office.md review fixes

Source: parent repository `OFFICE_MD_REVIEW.md` (2026-11-06).
Scope: this subrepository only. Do not stage the parent submodule pointer, update website pages, publish, or push.
Each finding is implemented and committed separately, with regression evidence and OpenSpec artifacts. Commit subjects identify the completed fix; use `git log --oneline` for hashes.

| Finding | Status | Fix / evidence |
| --- | --- | --- |
| F1 Export script injection | Done | CSS breakout regression and print sandbox tests pass; 184 unit tests, web/Electron builds, browser export test, specs pass. |
| F2 HTML sanitizer | Done | DOMPurify replaces denylist parsing; control-character, include and markup regressions; 186 unit tests, build, two browser tests and specs pass. |
| F3 Filesystem confinement | Done | Shared path policy rejects symlink reads and mutation endpoints; 187 unit tests, Electron build, three HTTP integration tests and specs pass. |
| F4 Save revision tracking | Done | Captured revisions and serialized saves; delayed typing, queued workspace switch and late completion regressions; 190 unit tests, build, two browser conflict/refresh tests and specs pass. |
| F5 Deleted browser files | Done | Missing known files now conflict before handle creation; explicit refreshed recreation remains supported; 191 unit tests, build and specs pass. |
| F6 Cache failures block saves | Done | Nonthrowing storage boundary; full-cache autosave regression red then green and blocked-storage startup test; 192 unit tests, build, both browser cases and specs pass. |
| F7 Unsafe mutation retries | Done | Removed automatic mutation reconnect/retry; lost document and image response tests pass; complete unit suite, build and specs pass. |
| F8 Application/state boundaries | Done | Private document session state and one export pipeline; shared Node filesystem service and thin HTTP/Vite transport; 197 unit tests, Electron build, all 42 editor/HTTP browser tests and specs pass. |
| F9 Workspace refresh/cache cost | Done | Incremental bounded Node/browser scans, deferred workspace caching and changed-only CSV evaluation; 201 unit tests, web/Electron builds, six refresh/cache browser tests and specs pass. |
| F10 Standalone image export | Done | Async export embeds local images, preserves remote URLs and reports missing assets; full unit suite/build and fresh-context network-blocked browser export tests pass. |
| F11 Branch/PR validation | Done | Read-only push/PR validation workflow runs unit, web/Electron build, specs and browser/Electron checks; YAML triggers/permissions verified; 203 local unit tests and specs pass. Hosted execution awaits a future push. |
| A1 Electron sender/navigation policy | Done | Main-frame and trusted-URL IPC authorization; blocked navigation/popups with HTTP(S)-only external opening; 205 unit tests, Electron build and all five desktop workflows pass. |
| A2 Theme containment | Done | Detached css-tree policy removes network/global/overlay CSS; subtree selector and paint containment; 207 unit tests, build, theme typography/export browser tests pass. |
| A3 Include expansion budgets | Done | Portable output stops at 32 include levels or 10 MiB; multiplying includes, depth, exact UTF-8 boundary, existing cycle/missing cases pass; 209 unit tests, build and specs pass. |
| A4 Session disposal | Done | Replaced/closed disk and style sessions are revoked after successful selection; explicit host close and late-refresh guards; 213 unit tests, Electron build and all 12 sharing/Desktop workflows pass. |
| A5 IPC payload validation | Done | Typed parsers validate workspace/style records, picker hints and bounded ZIP metadata/bytes before effects; 225 unit tests, Electron build, all eight desktop/HTTP integration tests and specs pass. |
| F9b CSV cache invalidation on reopen | Done | Reopening the same workspace now rebuilds missing CSV evaluations; browser regression red then green; 225 unit tests, build and specs pass. |

## Environment

Restored locked dependencies with `npm ci`. DOMPurify and css-tree were subsequently added as direct runtime dependencies, with css-tree TypeScript definitions as a development dependency; the lockfile records these additions. Generated build/test output remains ignored. All work starts at subrepo revision `46132f1`.

## Final verification — 2026-11-06

All 11 main findings, all 5 additional concerns, and the CSV cache integration follow-up are complete in 17 independent fix commits. A separate final verification commit records this handoff.

- `npm test`: 225 tests pass across 49 files.
- `npm run build` and `npm run build:electron`: pass.
- `npm run spec:validate`: all 9 accepted specifications pass; completed changes are synced and archived.
- Complete Playwright suite: all 56 browser, HTTP and real Electron tests pass. A temporary configuration under `/tmp` used port 43179 because port 4173 was occupied; the same test files ran with one worker and real Chromium/Electron.
- No source or generated output remains uncommitted in this subrepository after handoff.
- No push, release publication, workflow dispatch, parent website edit, or parent submodule-pointer staging was performed. Other existing parent-repository changes were left untouched.

The new branch/PR workflow has been reviewed and its checks run locally; hosted execution awaits a future push. Workspace and portable-export limits and the supported document-theme CSS policy are intentional and documented in accepted specs and README.
