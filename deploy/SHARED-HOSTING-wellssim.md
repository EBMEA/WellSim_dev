# WellSim on Spaceship shared hosting (cPanel + LiteSpeed)

**Written 11 September 2026**, after the owner chose shared hosting over a
VPS. This is the deployment path for `wellssim.app` as it is actually
configured today.

## What is on the other end, measured not assumed

```
wellssim.app       A     → 66.29.148.162
www.wellssim.app   CNAME → wellssim.app
NS                 launch1 / launch2.spaceship.net
:80   200, LiteSpeed, currently an EMPTY DIRECTORY LISTING
:443  open, but serves CN=server52.shared.spaceship.host
      (SAN: server52.shared.spaceship.host, www.…) — NOT this domain
:2083 open; /cpanel → https://server52.shared.spaceship.host:2083/
```

So: cPanel on LiteSpeed, the domain is pointed at it, nothing is deployed,
and **there is no certificate for `wellssim.app`**.

## Do this first, or nothing else matters

**Issue the SSL certificate.** `.app` is on the HSTS preload list — browsers
force HTTPS for it and will **hard-block with no click-through** when the
certificate name does not match. Right now every browser refuses the site
even though port 80 answers with a 200. The site is not "insecure", it is
unreachable.

> cPanel → **SSL/TLS Status** → tick `wellssim.app` and `www.wellssim.app` →
> **Run AutoSSL**

Wait for it to issue, then confirm from outside:

```bash
echo | openssl s_client -connect wellssim.app:443 -servername wellssim.app 2>/dev/null \
  | openssl x509 -noout -subject -dates -ext subjectAltName
```

You want `CN=wellssim.app` (or the domain in the SAN list). While it still
says `server52.shared.spaceship.host`, AutoSSL has not run or has failed —
usually because DNS had not propagated when it tried. Re-run it.

**Turn off directory indexing.** The root currently lists its own contents to
the world. cPanel → **Indexes** → set the document root to *No Indexing*. It
is empty today, which is the only reason this is harmless.

## Set up the Node app

cPanel → **Setup Node.js App** (CloudLinux Node.js Selector, which runs the
app under **Passenger**).

| Field | Value |
|---|---|
| Node.js version | the highest offered, and **not below 20.12** |
| Application mode | Production |
| Application root | `wellsim` |
| Application URL | `wellssim.app` (the domain root, no subpath) |
| Application startup file | `app.cjs` — **not** `app.js`; see below |

**If the version list tops out below 20.12, stop and say so** — the suite and
the server are developed against 20.12+ and this workstation runs 24.20.0.
That is the one thing on this path that cannot be worked around from here.

### Why the startup file is `app.cjs`, and why an ESM `app.js` gives a 503

cPanel wants a startup file at the application root; the server lives at
`src/server/server.js`. `app.cjs` is a wrapper committed for exactly this.

The first attempt used an ESM `app.js` and failed with a bare
**503 Service Unavailable** on every path. The reason: Passenger does not run
the startup file with `node file` — it `require()`s it from its own CommonJS
loader. Node 22.12+/24 can `require()` an ES module, **but not one whose
import graph contains a top-level `await`**, and this server's does
(`src/server/server.js:15`, `database = await initializeDatabase()`). The
load throws `ERR_REQUIRE_ASYNC_MODULE` before any of our code runs, and the
only trace is in the app's stderr log. Reproduced on the workstation with
`node -e "require('./app.js')"` on the same Node 24.20.0 the host runs.

`app.cjs` fixes it two ways at once: the `.cjs` extension forces CommonJS
despite `"type": "module"`, and inside it a dynamic `import()` is allowed to
resolve an async graph. Passenger simply waits for the app to call
`listen()`, which `server.js` does once the import settles. Verified the same
way — `require('./app.cjs')` boots, serves `/` and `/help.html`, and
`/api/accounts/status` reports `enabled:false`.

`server.js` reads `process.env.PORT ?? 3355` and binds
`process.env.HOST ?? '127.0.0.1'`. Passenger sets `PORT` and patches
`http.Server.listen`, so both defaults are already correct. Loopback is what
you want: Passenger reaches the app over a local socket, and nothing should
listen on a public interface of a machine you share with strangers.

## Get the code there

The repository is public, so cPanel's **Git™ Version Control** can clone it
directly — no deploy key, no credential on the server:

```
Clone URL:  https://github.com/EBMEA/WellSim_dev.git
Repository Path: /home/<user>/wellsim
```

Then **pin it**, rather than tracking `main`, so you know what is running:

```bash
cd ~/wellsim && git checkout 30427f9
```

If Git Version Control is not enabled on the plan, upload a zip of the same
commit through File Manager instead. Do **not** upload the working tree from
this workstation — it carries `node_modules`, `data/` and `ALdocs/`.

### Install dependencies

Use the **Run NPM Install** button in the Node.js App screen, or from the
app's virtualenv:

```bash
source /home/<user>/nodevenv/wellsim/<ver>/bin/activate
cd ~/wellsim && npm install --omit=dev
```

`pg` is **not optional** even though no database is involved: since `713ce46`
the server imports it unconditionally and crash-loops without it.

## Client data — read this before uploading `data/`

`data/` holds real saved cases from two client companies. On a VPS they sit on
a machine you control. **On shared hosting they sit on a multi-tenant box**
(`server52`), protected by Unix permissions and the host's isolation, with the
hosting provider's staff able to reach the filesystem. That is a different
risk posture from the one every earlier document in this project assumes, and
it is the owner's call to make knowingly rather than by default.

If you proceed:

```bash
mkdir -p ~/wellsim/data && chmod 700 ~/wellsim/data
```

Upload the cases out of band (File Manager or SFTP) — never through the
public repo, which is what `.gitignore` is protecting. The app runs fine with
an empty `data/`; it simply has no saved cases.

**Do not create any account, and do not restore an old `users.json`.** There
is no `users.json` anywhere any more — every copy on both drives was removed
on 9–10 September. An empty account list is the intended state, not a fault.

## The containment still binds, and it is easier to break here

`/api/accounts/status` must report
`{"enabled":false,"registrationEnabled":false,"mode":"legacy-web"}`, and it
must hold **two independent ways**:

1. the code gate `27ea04e`, which is an ancestor of `main`; **and**
2. `WELLSIM_ENABLE_LEGACY_CASE_STORE` **absent** from the environment.

On a VPS, (2) meant "absent from `wellsim.service`". Here it means **do not
add it in the cPanel environment-variable panel**. That panel makes adding a
variable a two-click operation with no review and no diff, which is precisely
why it is called out.

Verify after the app starts:

```bash
curl -s https://wellssim.app/api/accounts/status
```

## Nightly backups replace the systemd timer

`wellsim-backup.timer` cannot run here — there is no systemd. Use cPanel →
**Cron Jobs**, daily at 02:30:

```bash
cd /home/<user>/wellsim && tar czf ~/backups/wellsim-data-$(date -u +\%Y-\%m-\%d).tar.gz data && find ~/backups -name 'wellsim-data-*.tar.gz' -mtime +30 -delete
```

Create `~/backups` first, outside the document root so it is never served.
Note cPanel cron requires `%` to be escaped as `\%`.

**This is an on-box snapshot.** It survives a bad write, not a lost account.
The workstation's `data/` and the dated backups on D: and F: remain the real
off-box copies.

## What from `deploy/` does NOT apply on this path

Install none of these — they are for a VPS and will mislead anyone who finds
them:

- `cloud-init-wellssim.yaml` — Hetzner user-data
- `Caddyfile.wellsim` — LiteSpeed terminates TLS here, not Caddy
- `wellsim.service`, `wellsim-backup.*` — no systemd
- `CUTOVER-wellssim-app.md` — written for the VPS cutover
- `README-server-rebuild.md` — the 8 September capture of the old box

They stay in the repository as the record and as the path back to a VPS, which
remains available if shared hosting turns out not to fit.

## Verify, in this order

```bash
# 1. certificate is for THIS domain
echo | openssl s_client -connect wellssim.app:443 -servername wellssim.app 2>/dev/null \
  | openssl x509 -noout -subject

# 2. the app is serving, not the directory listing
curl -sS -o /dev/null -w '%{http_code}\n' https://wellssim.app/

# 3. containment
curl -s https://wellssim.app/api/accounts/status

# 4. the UI and manual load
curl -s https://wellssim.app/ | grep -o 'app\.js?v=[0-9a-z-]*'
curl -sS -o /dev/null -w '%{http_code}\n' https://wellssim.app/help.html

# 5. the calculation API answers
curl -s -X POST -H 'Content-Type: application/json' -d '{}' \
  https://wellssim.app/api/esp/pumps -o /dev/null -w '%{http_code}\n'
```

The asset stamp in step 4 should read `2026-09-10a`, matching
`CACHE_VERSION` in `src/ui/sw.js`. If they disagree, a stale service worker
will serve old assets to returning visitors.

## Known limits of this path, stated plainly

- **No systemd, so no `Restart=always`.** Passenger restarts the app on
  request after a crash, but there is no supervised service and no
  `NRestarts` counter to inspect.
- **The app may be idled out.** Shared hosts stop idle Node applications and
  start them on the next request; the first hit after a quiet period is slow.
- **Resource limits are the plan's, not the machine's** — CPU, memory and
  entry processes are capped per account and a heavy forecast run competes
  with them.
- **No `journalctl`.** Logs are the application's stderr file in the Node.js
  App screen, plus LiteSpeed's error log in cPanel.
- **The portable exe is unaffected** and remains the fallback delivery route.
