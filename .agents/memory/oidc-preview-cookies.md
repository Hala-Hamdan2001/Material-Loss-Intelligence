---
name: OIDC preview cookie delivery
description: Development proxy cookie attributes differ from direct API responses.
---
Do not assume source cookie options exactly match cookies delivered through the
development preview.

**Why:** Direct API login responses were observed with SameSite=Lax, while the
public development path delivered SameSite=None; both retained Secure/HttpOnly.
This is a delivery-path difference, not proof of session persistence or logout
failure. Production behavior was not verified.

**How to apply:** For authentication cookie investigations, compare sanitized
attribute flags on direct and proxied responses. Never print cookie/token values,
and verify the published path separately before making production claims.
