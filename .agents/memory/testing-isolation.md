---
name: Isolated browser regression infrastructure
description: Keep temporary API tests isolated without losing servers between browser actions.
---
Run destructive regression fixtures against a scratch database, not existing Demo
or private records. Verify original table checksums and explicit scratch cleanup.

**Why:** The user requires existing Demo and private data to remain intact.

**How to apply:** For a browser test using a temporary API, run the harness through
the main agent's persistent background-shell tool. A child server started in a
tester shell can terminate when that shell call returns. Stopping a background
task may also kill its cleanup trap: verify the scratch database is dropped and
temporary credentials/dumps are removed rather than trusting process shutdown.
