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
| F6 Cache failures block saves | Pending | |
| F7 Unsafe mutation retries | Pending | |
| F8 Application/state boundaries | Pending | |
| F9 Workspace refresh/cache cost | Pending | |
| F10 Standalone image export | Pending | |
| F11 Branch/PR validation | Pending | |
| A1 Electron sender/navigation policy | Pending | |
| A2 Theme containment | Pending | |
| A3 Include expansion budgets | Pending | |
| A4 Session disposal | Pending | |
| A5 IPC payload validation | Pending | |

## Environment

Restored locked dependencies with `npm ci`; package manifest and lockfile unchanged. Generated build/test output remains ignored. All work starts at subrepo revision `46132f1`.
