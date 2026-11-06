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
| A2 Theme containment | Pending | |
| A3 Include expansion budgets | Pending | |
| A4 Session disposal | Pending | |
| A5 IPC payload validation | Pending | |

## Environment

Restored locked dependencies with `npm ci`; package manifest and lockfile unchanged. Generated build/test output remains ignored. All work starts at subrepo revision `46132f1`.
