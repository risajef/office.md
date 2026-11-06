## Why

Electron IPC accepts requests without sender-frame checks and document navigation can leave the trusted application URL.

## What Changes

- Authorize IPC only from the main application frame at its trusted URL.
- Block renderer navigation and popups; open approved HTTP(S) links through the OS browser.
- Restrict update picker IPC to its own main frame.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-hosts`: Authorize Electron renderer capabilities

## Impact

Electron main IPC registration, window navigation policy and update picker frame checks.

Non-goals: Changing ordinary in-editor link editing or updater network configuration.
