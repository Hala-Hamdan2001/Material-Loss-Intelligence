# Logout → login-again audit

## Evidence boundaries

The user reports completing genuine Replit login/consent, reaching a private
Manager workspace and using Demo successfully, then seeing signed-out UI after
logout. This is user-reported real-provider evidence, not an agent browser test.
Approval/callback completion after logging out has not yet been reported or tested.

No application code, configuration, database schema, business records, or roles
were changed in this follow-up. Live probes initiated login without completing
authentication, retaining credentials, or modifying a real session.

## Trace

- `menu-login` / `button-login` call the shared `useAuth().login()`.
- Private-workspace controls call `go('private')`; if signed out, it calls that
  same login function and returns. Both navigate to `/api/login?returnTo=/`.
  Private selection is not remembered by this branch; after login, the user may
  need to select Private again.
- `/api/login` discovers Replit OIDC, creates fresh state/nonce/PKCE verifier,
  stores ten-minute HttpOnly/Secure cookies, and redirects with S256 plus
  `prompt: 'login consent'`. Scopes are `openid email profile offline_access`.
- `/api/callback` requires nonce, state and verifier cookies. It passes
  expectedNonce, expectedState, pkceCodeVerifier and idTokenExpected to
  openid-client. On success it clears transient cookies, upserts the verified
  account, inserts a fresh random session in PostgreSQL, sets the session cookie,
  and redirects to a validated local return path.
- Missing callback cookies or failed authorization-code validation return to
  `/api/login`, which requests consent again. Discovery/database failures reach
  the generic server error handler. No detailed callback error is exposed to the
  UI, so a repeated consent screen **after approval** could represent a failed
  callback; the current observation alone does not prove such a failure.
- `/api/auth/user` loads the session through middleware, including expiry/refresh
  handling, and returns the server-derived user or null. The React hook fetches
  it on mount; a full callback navigation mounts it again. Existing tabs are not
  a real-time shared authentication display; reload when checking another tab.
- `/api/logout` clears workspace-selection cookies and awaits local database
  session deletion, then clears `sid`, before provider discovery/logout URL
  construction/redirect. Provider failure falls back locally after invalidation.
  This invalidates this local session, not all sessions on all devices.

## Checks actually performed

Fresh anonymous `/api/auth/user`: HTTP 200 with null user.
Two live development login starts: HTTP 302 to replit.com, explicit
`login consent`, S256, same-origin callback, distinct state/nonce/challenge.
Four transient cookies on each start: root path, ten-minute lifetime,
Secure and HttpOnly.

Cookie delivery nuance: direct API responses set SameSite=Lax; the public
development path delivers SameSite=None while retaining Secure/HttpOnly.
That difference was measured, not inferred. It is not evidence of failure to
delete the local session. Published-domain behavior was not tested.

Prior isolated tests established local session deletion during provider failure,
old-token denial, invalid/expired/deleted-session denial, and missing-nonce
callback rejection. They were not rerun unnecessarily here and do not establish
real provider consent, callback success, refresh, or provider logout.

## Conclusion and remaining manual check

Repeated consent is consistent with this application's explicit prompt. The
provider showing an already authenticated Replit account does not show that the
application session survived logout. Provider account recognition and the
application's session are separate; no claim is made about which provider-side
cookies remain or whether provider logout completed.

To complete the outstanding real loop, use one standalone app tab and close stale
pending consent tabs:

1. After app logout, open `/api/auth/user` on that same origin; expect null.
2. Use either login button, approve once, and wait for return to the app.
3. Open `/api/auth/user` again on that origin; expect your account, not null.
4. Reload the app and select the existing private workspace; confirm Manager
   access without editing records.
5. Log out again, confirm null, then repeat login/approval and confirm non-null.

Only report null/non-null, whether return to the app occurred, and any visible
error. Never share cookies, tokens, callback query strings or account responses.
Do not initiate parallel pending logins: they share transient cookies and a newer
attempt replaces the earlier attempt's state/nonce/verifier. Old callbacks can
therefore be correctly rejected.

If approval loops back to consent, stop repeating it and report that specific
failure. Inspect status/path-only request evidence next, without weakening
nonce/state/PKCE. No new code defect was confirmed by this follow-up.
