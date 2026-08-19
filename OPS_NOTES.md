# Production Ops Notes — vantly.social (WHM/cPanel host)

Incident log / runbook for infra issues on the production cPanel box hosting
the Postiz (vantly) Docker stack. Keep appending here — this stack sits
behind an unusually deep proxy chain (Cloudflare -> EA-Nginx -> Apache ->
Docker -> internal nginx -> Next.js/Nest), and most incidents so far have
been in that chain, not in the app itself.

## Stack topology (as of Aug 2026)

```
Client
  -> Cloudflare (proxied DNS for vantly.social)
  -> EA-Nginx on the cPanel box, port 443 (host nginx, NOT the container's)
       - only /api/ has a custom override: /etc/nginx/conf.d/users/vantly/vantly.social/zz-api-proxy.conf
         (proxies straight to 127.0.0.1:4007, cache explicitly off)
       - everything else (including /) falls through to cPanel's default
         per-account template, which proxies to Apache on port 444
         (proxy_cache_path .../ea-nginx/proxy/vantly, keys_zone=vantly:10m,
         inactive=60m — cached by default, unlike the /api/ override)
  -> Apache (httpd), port 444, docroot /home/vantly/public_html
       - routing is entirely via /home/vantly/public_html/.htaccess
         (mod_rewrite `RewriteRule ^(.*)$ http://127.0.0.1:4007/$1 [P,L]`)
       - NOTE: the .htaccess comment referencing
         "userdata/zzz_proxy.conf" for ProxyPreserveHost is stale —
         that file does not exist. ProxyPreserveHost is NOT actually set.
  -> docker-proxy on the host, 127.0.0.1:4007 -> container postiz:5000
  -> container's OWN internal nginx (nginx/1.22.1, config baked into image
     at var/docker/nginx.conf) splits /api/ -> localhost:3000 (backend),
     everything else -> localhost:4200 (frontend)
  -> pm2-managed processes inside the container: backend (3000),
     frontend/Next.js (4200), orchestrator (Temporal worker)
```

docker-compose.yaml also brings up: postiz-postgres, postiz-redis, spotlight
(sentry), and a full Temporal stack (temporal, temporal-postgresql,
temporal-elasticsearch, temporal-ui, temporal-admin-tools). That's a lot of
containers to restart at once — see incident #1.

## Incident #1 — `docker compose up` fails: DOCKER-ISOLATION-STAGE-1 chain missing

**Symptom:** `docker compose up` fails with
`unable to insert jump to DOCKER-ISOLATION-STAGE-1 rule in FORWARD chain:
... Chain 'DOCKER-ISOLATION-STAGE-1' does not exist`.

**Root cause:** CSF (ConfigServer Security & Firewall) periodically rewrites
the entire iptables ruleset from scratch (`csf -r`, WHM firewall restarts,
reboots). This wipes out the custom chains Docker created at daemon
startup, including DOCKER-ISOLATION-STAGE-1. Docker doesn't notice and only
recreates them when the Docker daemon itself restarts.

**Fix (immediate):** `systemctl restart docker`, then retry the compose
command.

**Fix (permanent):** Added a CSF post-restart hook so Docker gets restarted
automatically every time CSF reloads iptables:
`/etc/csf/csfpost.sh` (CSF runs this after every `csf -r` / reboot):
```sh
#!/bin/sh
systemctl restart docker
```
(chmod +x on the file.)

## Incident #2 — 502 Bad Gateway after Incident #1's fix: CSF blocking Docker bridge forwarding

**Symptom:** Site returns 502. `docker compose ps` shows all containers
healthy. `curl http://127.0.0.1:4007/` (the published app port) TCP-connects
fine but the connection resets the moment a request is sent
(`Recv failure: Connection reset by peer`). Host nginx error log shows
`recv() failed (104: Connection reset by peer)` / `no live upstreams`.

**Root cause:** Separate from Incident #1's isolation-chain issue — CSF was
also interfering with traffic being forwarded across the Docker bridge
network itself (a known category of CSF+Docker conflict, distinct from the
isolation-chain problem). Confirmed by testing from *inside* the container
(`docker exec postiz node -e "require('http').get(...)"` against ports
3000/4200/5000 — all fine), proving the app was healthy and the break was
purely in host-level forwarding.

**Fix (diagnostic):** `csf -x` (disable) then retest — if it works with CSF
off, CSF is confirmed as the cause. Re-enable immediately (`csf -e`)
regardless of result; don't leave the firewall off.

**Fix (permanent):** Exempt the Docker bridge interface for this compose
network from CSF filtering via `/etc/csf/csfpre.sh` (CSF runs this BEFORE
applying its own restrictive ruleset, so it survives every `csf -r`):
```sh
#!/bin/sh
IFACE=br-xxxxxxxxxxxx   # find via: docker network inspect vantly_postiz-network
iptables -I INPUT -i $IFACE -j ACCEPT
iptables -I FORWARD -i $IFACE -j ACCEPT
iptables -I FORWARD -o $IFACE -j ACCEPT
```
(chmod +x, then `csf -r` to apply.)

**Cleanup note:** Docker restarts during this kind of troubleshooting can
leave orphaned bridge interfaces behind at the OS level even after their
Docker network object is already gone (`docker network inspect <id>` ->
"not found", but `ip link` still shows `br-xxxxxxxxxxxx`). `docker network
prune` only removes networks Docker still tracks; it won't touch these.
Since Docker has no record of them, they're safe to remove directly:
`ip link delete br-xxxxxxxxxxxx type bridge`.

## Incident #3 — Site works internally but public vantly.social returns 404 (looked like caching, wasn't)

**Symptom:** `curl http://127.0.0.1:4007/` and every direct test to the
container/app always returned a clean `307` to `/auth`. But
`https://vantly.social/` consistently returned a `404` "This page could
not be found" with `x-nextjs-cache: HIT`, completely unaffected by:
pm2 restarting the frontend, clearing `.next/cache` inside the container,
purging `/var/cache/ea-nginx/proxy/vantly/*`, `systemctl restart nginx`
(host), and a full `docker compose build` (which was a no-op anyway since
Docker layer-cached the unchanged source).

**Root cause:** Apache's docroot behavior — `DirectoryIndex` — was
silently rewriting requests for `/` into `/index.php` *before* the
`.htaccess` proxy `RewriteRule` got a chance to act on the original path.
Confirmed by checking the container's own internal nginx access log
(`docker exec postiz sh -c "tail -5 /var/log/nginx/access.log"`), which
showed every real request logged as `GET /index.php`, never `GET /`. Since
`/index.php` genuinely doesn't exist as a Next.js route, the app correctly
(and cacheably) rendered a 404 for it every time — this was never actually
a stale-cache bug, just every manual test (including ours) using the
literal path `/` and bypassing the rewrite, which is why the app always
looked perfectly healthy in isolation while every real visitor got 404s.

This had nothing to do with Incidents #1/#2 or Cloudflare/EA-Nginx caching
— those were red herrings chased first because `x-nextjs-cache: HIT`
strongly suggested a caching layer. The giveaway that finally cracked it
was comparing Apache's own domlog (empty — Apache logging wasn't the
issue) against the *container's* internal access log, which showed the
mangled path directly.

**Fix:** Add to the top of `/home/vantly/public_html/.htaccess`:
```
DirectoryIndex disabled
```
This tells Apache not to resolve `/` to an index file at all, since this
is a full reverse-proxy setup, not a static/PHP site.

**Verification:**
```sh
curl -sIk https://72.167.55.127:444/ -H "Host: vantly.social"   # bypass EA-Nginx, hit Apache directly
curl -sI https://vantly.social/                                  # full public path
```
Both should show `307` to `/auth` with no `x-nextjs-cache` header.

## Useful diagnostic commands for next time

```sh
# Container status / logs
docker compose --env-file .env.prod ps
docker compose --env-file .env.prod logs --tail=150 postiz
docker exec -it postiz pm2 list
docker exec -it postiz pm2 restart <backend|frontend|orchestrator>

# Test the app directly, bypassing all proxy layers (loopback, published port)
curl -sI http://127.0.0.1:4007/

# Test the app from INSIDE the container (no ps/curl in this image — use node)
docker exec -it postiz node -e "for (const p of [3000,4200,5000]) { require('http').get({host:'localhost',port:p,path:'/'}, r=>{console.log(p,'STATUS',r.statusCode); r.resume();}).on('error', e=>console.log(p,'ERROR',e.message)); }"

# Test bypassing Cloudflare (hit the origin's public IP directly with correct SNI/Host)
curl -sI --resolve vantly.social:443:72.167.55.127 https://vantly.social/

# Test Apache directly, bypassing EA-Nginx (port 444 is Apache's SSL vhost port)
curl -sIk https://72.167.55.127:444/ -H "Host: vantly.social"

# See what's actually listening on the key ports
ss -tlnp | grep -E ':444|:81|:443|:4007'

# Ground truth for "did the request actually reach the app": the
# CONTAINER's own internal nginx access log, not Apache's domlog
docker exec postiz sh -c "tail -20 /var/log/nginx/access.log"

# cPanel's authoritative per-domain config (docroot, IP, port)
cat /var/cpanel/userdata/vantly/vantly.social
```

## Still pending (as of this writing)

- **R2 public bucket for channel icons / uploads:** `CLOUDFLARE_BUCKET_URL`
  in `.env.local`/`.env.prod` currently points at the private R2 S3 API
  endpoint (`https://<account>.r2.cloudflarestorage.com/vantly/`), which
  requires signed requests and can't be hotlinked in `<img>` tags — that's
  why channel icons don't load. Also has a trailing-slash bug causing a
  double slash in generated URLs. Needs: enable public access on the R2
  bucket (custom domain, e.g. `cdn.vantly.social`, recommended over the
  `r2.dev` subdomain for production), update `CLOUDFLARE_BUCKET_URL` to
  that public URL (no trailing slash), restart the app, and backfill
  already-stored URLs in the DB that still reference the old domain.

## LinkedIn: two separate integrations need two separate LinkedIn apps

**Constraint:** LinkedIn's Community Management API (needed for the
"LinkedIn Page" / organization posting scopes: `rw_organization_admin`,
`w_organization_social`, `r_organization_social`) cannot be enabled on the
same LinkedIn Developer app as "Sign In with LinkedIn using OpenID Connect"
or "Share on LinkedIn" (needed for personal-profile posting). LinkedIn
enforces this at the app-product level, not something fixable in code by
itself.

**Fix implemented (Aug 2026):** Split into two separate credential pairs:

- `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` — personal-profile app
  (Sign In with LinkedIn + Share on LinkedIn products). Used by
  `linkedin.provider.ts`. Scopes trimmed to
  `openid profile w_member_social r_basicprofile` only.
- `LINKEDIN_PAGE_CLIENT_ID` / `LINKEDIN_PAGE_CLIENT_SECRET` — separate app,
  Community Management API as its ONLY product. Used by
  `linkedin.page.provider.ts` (all 3 spots: `refreshToken`,
  `generateAuthUrl`, `authenticate`). Redirect URL registered on that app:
  `https://vantly.social/integrations/social/linkedin-page`.

Both env vars need to be set in `.env.prod` (and passed through in
`docker-compose.yaml`, already wired) before rebuilding/redeploying:
`docker compose --env-file .env.prod build postiz && docker compose
--env-file .env.prod up -d postiz`.

## X (Twitter): OAuth "authentication failed" - App not attached to a Project (client-not-enrolled)

**Symptom:** Connecting an X channel worked all the way through X's own OAuth
screen ("Redirecting you back to the application...") but the app then showed
a generic "authentication failed" message. Callback URL and App permissions
(Read+Write+DM) in the X Developer Portal were both correct - neither was the
cause.

**Root cause:** `no.auth.integrations.controller.ts`'s `/integrations/
social-connect/:integration` handler swallowed the *real* error from
`integrationProvider.authenticate()` and always returned the generic string
"Authentication failed", with no logging at all. Added a `console.log` in
that catch block (logs `err.data` when present) to surface the real error -
this is a permanent diagnostic improvement, keep it.

With that logging in place, the real error from X was:

```
{"client_id":"33317654","detail":"When authenticating requests to the X API
v2 endpoints, you must use keys and tokens from a developer App that is
attached to a Project. You can create a project via the developer portal.",
"reason":"client-not-enrolled","title":"Client Forbidden"}
```

X restructured API access in 2023: every App's keys/tokens only work for v2
endpoints (including `GET /2/users/me`, which `XProvider.authenticate()`
calls right after login to fetch the connected profile) if that App is
attached to a **Project** with an active access tier (Free/Basic/Pro/
Enterprise). `client.login(code)` (the OAuth 1.0a handshake itself) succeeds
regardless - which is why X's own redirect screen looked fine - but the
follow-up `v2.me()` call 403s, and that's what actually failed.

**Fix:** In the X Developer Portal (developer.x.com), the App behind
`X_API_KEY`/`X_API_SECRET` (client_id `33317654`) needs to be attached to a
Project (Projects & Apps section). If it's a legacy/standalone app created
before Projects existed, either move it into an existing Project or create a
new Project and attach it there, then make sure the Project has an active
access tier selected. No code change needed for this part - purely an X
Developer Portal / account configuration issue.

**Diagnostic command** (works for any provider now, not just X):
```
docker compose --env-file .env.prod logs --tail=200 postiz | grep -i -A5 -B5 "social-connect authenticate failed"
```

**Confirmed resolution (Aug 19 2026):** The keys in `.env.prod` were already
correct the whole time (app_id 33317654, "vantly-app") - the confusing part
was the X Developer Portal's Overview page grouping this app under a
"Vantly Social" (Free) project, while the app's own Keys & Tokens page
showed its real Project Access as a *different* project ("The AgenticAI")
that wasn't fully enrolled for Pay-Per-Use v2 access yet. Moving the app to
an active pay-as-you-go plan (via Project Access -> Manage on the app's own
page, not the account Overview page) fixed it immediately - no code change,
no key change needed. If this resurfaces: don't trust the portal's Overview
grouping: open the specific App -> Keys & Tokens page and check "Project
Access" there directly.

## OAuth "authentication failed" logging audit across all providers (Aug 19 2026)

Following the X root-cause hunt above, audited every provider file's
`authenticate()` (and the `pages()`/`companies()`/`reConnect()` helpers the
OAuth callback controller calls synchronously right after it) for the same
silent-swallow pattern: a `catch` that discards the real error and returns a
hardcoded generic string/array with no logging.

**Important: the fix already made to `no.auth.integrations.controller.ts`
(the console.log in its outer catch) is provider-agnostic** - it covers
every provider that calls through `/integrations/social-connect/:integration`
(Reddit, Discord, Facebook, LinkedIn, etc. included), as long as the
provider's own `authenticate()` doesn't catch-and-swallow the error itself
before it can bubble up. So for most providers nothing further was needed -
just retry the connection and grep the same log line:
```
docker compose --env-file .env.prod logs --tail=200 postiz | grep -i -A5 -B5 "social-connect authenticate failed"
```

**5 providers DID have their own internal silent swallow** (not covered by
the controller fix, since the error never reached it) - fixed by adding
`console.log` before the existing generic return, no behavior change
otherwise:
- `dev.to.provider.ts` - `authenticate()` catch
- `hashnode.provider.ts` - `authenticate()` catch
- `medium.provider.ts` - `authenticate()` catch
- `skool.provider.ts` - `authenticate()` catch
- `whop.provider.ts` - `companies()` AND `experiences()` catches (these run
  right after authenticate() succeeds, for the two-step page-picker flow)

All other providers checked (bluesky, discord, facebook, instagram x2, gmb,
dribbble, reddit, pinterest, tiktok, threads, youtube, tumblr, twitch,
slack, telegram, mastodon x2, mewe, vk, wordpress, farcaster, kick, lemmy,
listmonk, moltbook, nostr) were already clean - either no internal catch (so
the controller fix already surfaces the error), or the existing catch
already logs before returning a generic message.
