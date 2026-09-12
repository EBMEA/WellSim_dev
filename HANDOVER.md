# WellSim — handover

**Live:** **[https://wellssim.app](https://wellssim.app)** since 12 Sep 2026 (note the double s) — Spaceship shared hosting, cPanel/LiteSpeed/Passenger, Node 24.20.0, deployed commit `dddd787`; wellsim.app (single s) retired 8 Sep ·
**Codex comparison:** https://bldrz.net ·
**Repo:** https://github.com/EBMEA/WellSim_dev · **Manual:** `src/ui/help.html` (served at /help.html by a local run)

**WELLSIM.APP IS RETIRED.** On 8 September 2026 the owner retired the domain
outright and took WellSim off the Hetzner box. **There is no production site.**
The app runs **locally** (`npm start`, http://localhost:3355) and as the
portable exe until a new domain is chosen and stood up.

What was done to `91.98.23.255`, in order, each step verified:

1. Final `data/` pull taken and **read back**: 4 accounts, 8 cases, every one
   parsing as a WellSim case. Captured with the 30-day backup history, the
   configs and a server inventory to `WellSim-ServerRetirement-2026-09-08`
   on **D: and F:**, 11/11 checksums OK on both.
2. The two `wellsim.app` blocks removed from `/etc/caddy/Caddyfile`
   (backed up as `Caddyfile.bak-20260908`), `caddy validate` run **before**
   the reload, then reloaded.
3. `systemctl disable --now wellsim.service wellsim-backup.timer` —
   both inactive and disabled, port 3355 free on the box.
4. `/opt/wellsim` → `/opt/wellsim.retired-2026-09-08` and
   `/var/backups/wellsim` → `/var/backups/wellsim.retired-2026-09-08` —
   moved rather than deleted, so the irreversible step stayed the owner's.
5. **The owner then took that step, and it is verified:** `/opt/wellsim*` and
   `/var/backups/wellsim*` are gone from the box, port 3355 is free, the
   Caddyfile names only thepwf.net and bldrz.net (both HTTP 200) and its log
   carries no warnings. **WellSim's data is off that machine.** The only
   copies now are the capture on D: and F: and the workstation's own `data/`.
6. **The units went too**, also verified: `wellsim.service`,
   `wellsim-backup.service`, `wellsim-backup.timer` and
   `/usr/local/bin/wellsim-backup` are off the disk and systemd knows no
   wellsim unit at all. Caddy stayed active through it and thepwf.net and
   bldrz.net still answer 200, with no failed units on the box. All four
   files are committed verbatim under `deploy/`, so nothing was lost.
7. **The DNS records are deleted**, 8 September. The `wellsim.app` zone at
   Cloudflare held exactly two records — `A wellsim.app` and
   `A www.wellsim.app`, both → `91.98.23.255`, unproxied — and no MX, TXT or
   verification record of any kind, so removing them broke no mail and no
   domain ownership proof. **The zone is now empty (0 records).** Both names
   return no address; `www` returns NXDOMAIN outright. thepwf.net and
   bldrz.net answered 200 throughout. The name now fails to resolve rather
   than resolving to a machine that ignores it.

**The box lives on and still serves the other two sites**, which were never
touched: thepwf.net and bldrz.net both verified HTTP 200 after the Caddy
reload, their `www` names 301 as before. bldrz keeps its own PostgreSQL
database and runtime user.

Still outstanding:

- **the `wellsim.app` registration itself.** The zone still exists at
  Cloudflare — empty, 0 records — and the domain is still registered in the
  owner's name. Nothing depends on either, and keeping them costs only the
  renewal: it holds the name against anyone else registering it, and an empty
  zone serves nothing. **Letting it lapse is a one-way door** — the name
  becomes available to the world, and the brochure and meeting invite in
  ALdocs still print it. Whichever way, it is the owner's call at the
  registrar, and there is no hurry.
- the `wellsim` service user (uid 996, `/usr/sbin/nologin`, home
  `/opt/wellsim` which no longer exists) is all that is left of the app on
  that box. It owns nothing and can log in nowhere; `userdel wellsim` closes
  it whenever it suits, and is the last thing to do there.
- ~~when the new domain exists~~ **it does: `wellssim.app`, 11 September 2026.**
  See `deploy/CUTOVER-wellssim-app.md` for the launch order,
  `deploy/cloud-init-wellssim.yaml` to build the box, and
  `deploy/Caddyfile.wellsim`, which now names the new domain.
  **Every published reference to wellsim.app still needs updating in one pass** —
  the manual, README, README-PORTABLE, the brochure and the meeting invite in
  ALdocs all still print a name that resolves nowhere.

The containment travels with the retirement: the account store was shut when
the site went down, and any new box must pass the same check before DNS points
at it — `/api/accounts/status` must report
`{"enabled":false,"registrationEnabled":false}`. **`main` now CONTAINS `27ea04e`**
(verified with `git merge-base --is-ancestor`), so the old blanket ban on
deploying it is spent — but the check itself still has to pass on the new box
before DNS points at it.

**The containment held to the end, and it still binds the next box.** While
the site ran, `/api/accounts/status` reported
`{"enabled":false,"registrationEnabled":false,"mode":"legacy-web"}` and the
Sign in entry was hidden. It held two ways over — the gate commit `27ea04e` on
the deployed branch, AND `WELLSIM_ENABLE_LEGACY_CASE_STORE` absent from
`wellsim.service` (`Environment=PORT=3355 NODE_ENV=production`). Either alone
would keep registration closed. Both requirements carry forward verbatim to
whatever machine serves the new domain.

**`main` IS NOW SAFE TO DEPLOY, and earlier revisions of this file said the
opposite.** `27ea04e` was not on `main` until the 10 September merge; it is an
ancestor now, so a fresh box built from `main` does **not** reopen public
registration. The check in `deploy/README-server-rebuild.md` still has to pass
before any DNS points at anything — the gate being in the code is one of the
two halves, not both.

**Current working tree:** clean, on `main`, **345/345 tests passing** — re-run
on 10 Sep against the merged tree, not carried forward as a claim. The
separate `bldrz` database has migrations `0001`–`0003`, with least-privilege
roles and an opt-in, bounded PostgreSQL connection pool.

**Where the work sits, 11 September 2026:** `main` at `23ecd4f`
(199 commits), pushed and in sync with a **new** remote. The feature branch
is gone — merged and retired the same day.

- `merge/gas-forecast-into-v2` **fast-forwarded into `main`**. `main` was a
  strict ancestor of it (0 behind, 114 ahead), so there is **no merge
  commit** and the history is linear. The branch was then deleted locally
  and on the new remote; it was left in place on `origin`.
- **`main` no longer lacks `27ea04e`.** Earlier revisions of this file and of
  the backup READMEs warned that it did and that `main` "must not be deployed
  anywhere". That is resolved. There is still nothing to deploy to.

**The remotes disagree, and it matters which one you reach:**

| remote | repository | `main` |
| --- | --- | --- |
| `wellsim-dev` | `EBMEA/WellSim_dev` | `23ecd4f` — **current**, default branch |
| `origin` | `aleimam/wellsim` | `de2393c` — 120 commits behind |
| `ebmea` | `EBMEA/wellssim` | untouched (note the double `s`) |

`origin` has received **none** of this work, and its copy of the feature
branch (`8423d73`) is five commits behind what was merged. Local `main` now
tracks `wellsim-dev/main` — it previously tracked nothing at all — so a bare
`git push` or `git pull` goes to `EBMEA/WellSim_dev`. Reaching the other two
takes an explicit remote name.

**`EBMEA/WellSim_dev` is a public repository.** Before the first push the
whole history on every branch was scanned for private keys, cloud tokens and
inline secret assignments; nothing was found outside false positives in the
vendored `src/ui/vendor/plotly.min.js`. What *is* public beyond code was
published knowingly: `deploy/` carries real hostnames, the Caddy config and
the systemd units as they ran, and this file narrates the infrastructure and
the credential purge in detail. None of it is a credential. The gitignore
that keeps `data/`, the workbooks, the ESP catalogue and `ALdocs/` out of git
is what makes that safe, and it was re-checked.

**12 September 2026 — WellSim is LIVE at https://wellssim.app.** Verified
from outside, not from the console:

- Certificate: **Let's Encrypt**, SAN `wellssim.app` + `www.wellssim.app`,
  valid to 10 Dec 2026, full chain OK. Two self-signed certificates were
  generated in cPanel before the real one issued; both are gone.
- `/` serves the WellSim UI (title *WellSim — Nodal Analysis*, asset stamp
  `2026-09-10a`), `/help.html` 74 KB, `app.js` 212 KB, vendored Plotly 4.5 MB
  — all 200 over HTTPS.
- **Containment holds:** `/api/accounts/status` →
  `{"enabled":false,"registrationEnabled":false,"mode":"legacy-web"}`.
- **38/38 module smoke** passes against the live URL — every module, both
  fluids, both lift types, the injector, the forecast.
- Headers: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.

**Where it runs, and the choice behind it.** The owner chose **Spaceship
shared hosting** over the Hetzner VPS: cPanel on LiteSpeed at
`66.29.148.162` (`server52.shared.spaceship.host`), the app under CloudLinux
Node.js Selector / Passenger, **Node 24.20.0** — the same version as this
workstation. Application root `/home/solmuygadd/wellsim`, URL at the domain
root, startup file **`app.cjs`**. The runbook for it is
`deploy/SHARED-HOSTING-wellssim.md`; the VPS files stay in `deploy/` as the
path back.

**Two things that went wrong on the way, both worth knowing:**

- The app was first mounted at `/wellssim.app/` (a subpath) with the domain
  root serving a directory listing. The UI is written for the root — absolute
  `/api/…`, `/app.js`, and a service worker at `/sw.js` — so a subpath mount
  boots and then cannot load itself. Fixed by setting Application URL to the
  bare domain.
- The first real deploy answered **503 on every path**. Passenger `require()`s
  the startup file, and Node cannot `require()` an ES module whose graph has
  a top-level `await` — ours has one at `src/server/server.js:15`. The ESM
  `app.js` was replaced by **`app.cjs`** (CommonJS, dynamic `import()`); the
  failure was reproduced and the fix verified locally on the same Node before
  redeploying. `deploy/SHARED-HOSTING-wellssim.md` had said "must stay ESM";
  that was the wrong half of the truth and is corrected.

**Still true on this host:** `data/` is empty — no client cases were uploaded,
by decision pending the shared-hosting risk note in the runbook. No nightly
backup cron exists yet. `crt.sh` will show the certificate once its indexer
catches up; its absence there is lag, not a problem.

**11 September 2026 — the relaunch begins.** The owner bought
**`wellssim.app`** from Spaceship (note the DOUBLE S; the retired name is
`wellsim.app`, single s, still registered and still empty at Cloudflare).
Checked the same day:

- `wellssim.app` resolves to Spaceship parking (`34.216.117.25`,
  `54.149.79.189`, AWS us-west-2) on NS `launch1`/`launch2.spaceship.net`.
  Port 80 answers 200 with a parking page; **443 times out** and `www` does
  not resolve. No MX, no TXT.
- **`.app` is on the HSTS preload list.** Browsers force HTTPS for it with no
  click-through, so that parking page is invisible in practice and the name
  is dark until a certificate issues. There is no http-only state to test in.
- `deploy/Caddyfile.wellsim` named the retired domain and would have asked
  Let's Encrypt to cover a dead name. It now names `wellssim.app`.

**The server is not created yet, and this workstation cannot create it.**
There is no `hcloud` CLI, no `HCLOUD_TOKEN`, no `~/.config/hcloud` and an
empty `~/.ssh` — the deliberate outcome of the 8–9 September purge. Creating
it needs the owner at the Hetzner console.

- **Plan: Hetzner Cloud CX22** (2 vCPU / 4 GB / 40 GB, Falkenstein or
  Nuremberg), or `CAX11` on ARM. The app needs **Node and Caddy only** — the
  database boundary is disabled, though `pg` must still be installed or the
  server crash-loops.
- `deploy/cloud-init-wellssim.yaml` performs the build order as user-data and
  writes its own verification to `/root/BOOTSTRAP-REPORT.txt`. It clones the
  public repo **pinned to an exact commit** and aborts the boot on mismatch;
  it leaves **Caddy stopped** until DNS moves; it restores no `data/` and
  creates no account, both on purpose.
- **Rotate the Hetzner and Cloudflare tokens first.** They were deleted here
  but never revoked, and `wellsim-deploy` is still in the old box's
  `authorized_keys`. Building the new machine is the moment to close that so
  the two never share a credential.

**What was actually run on 10 September, and what it showed.** None of this
is carried forward from an earlier entry:

- `npm test` — **345/345 pass, 0 fail**, 138 s, on the merged tree.
- The dev server was started from `.claude/launch.json` and driven in a
  browser, then stopped. It logged **`bound to 127.0.0.1 (this machine
  only)`** — `9943e99` still doing its job — and `PostgreSQL boundary:
  disabled`. Oil Well solved at 2132 stb/d, Pwf 2647 psi, AOF 6369. Gas Well
  → Forecast produced the p/Z tank + nodal chart and a 60-row table, every
  request 200, no console or server errors.
- The behaviour `de2393c` describes was confirmed **directly, in the UI**:
  the chart carries **one** FTHP line — a history trace and a forecast trace
  of the same quantity — and **FTHT appears only as a table column**, not as
  a chart trace.
- A full backup was taken and mirrored: **`WellSim-FullBackup-2026-09-10` on
  D: and F:**, 187 MB, **26/26 checksums OK on each**, manifests identical.
  The bundle was cloned back from *both* copies as a restore drill and each
  landed on `main` `3a0a720`, tree `9afa218d`, matching the working copy.
  Its `local-data/` tarball was **rebuilt from disk, never copied forward** —
  140 entries, 81 case files, **zero `users.json`** — and searched for hash,
  salt and password material before being sealed. Nothing found.
- Later the same day, after this file was first updated and pushed
  (`50b345f`): **`WellSim-FullBackup-2026-09-10b`** on both drives, sealed at
  `50b345f`, superseding `-10`; and a fresh **`WellSim-Handover-2026-09-10`**
  on both drives, 181/181, with `npm test` 345/345, the 43/43 sweep and the
  38/38 module smoke all run against the exported copy itself. Its
  `07-workstation-data` no longer carries credential material, its
  `03-specification` now includes `aldocs.tar.gz` (the lift-selection
  workbook is the authority for the metres depth band; earlier handovers
  omitted it), and it has no server-data tarball because there is no server.
- **The backup series was pruned to three** (`-09d`, `-10`, `-10b`) and the
  handovers to one, on both drives — 46 + 4 folders deleted, ~2.7 GB freed
  per drive. Before deletion, two things that existed *only* in the pruned
  folders were rescued into `-10b`: the **build hash records for portables
  1.3–2.5** (`portable/build-records-1.3-2.5/`, the only surviving proof of
  what those now-deleted binaries were) and the **5 Sep evening handover
  addendum** (`records/`). The one real loss: intra-day server pulls from
  5–8 Sep; the retirement capture keeps one per day and the final pull.
- **The password hashes were removed from every archive on both drives** —
  see the account under *Operational knowledge*, which this replaces.

**The bundle is no longer the only off-machine copy of the recent work.** The
four commits that `WellSim-FullBackup-2026-09-09d` flagged as unpushed —
`9fc79be`, `9943e99`, `5025ccf`, `3a0a720` — are on GitHub as of today. The
Windows Credential Manager problem that blocked that push did not recur; the
`gh` CLI credential carried it.

**The newest portable release is 2.7** (`D:\WellSim_2.7`, also on F:), built
from `8423d73` and signed `CN=M. El-Ashry`. It carries everything the retired
site carried, so **the portable is now the delivery vehicle** — demos and
daily work need no domain at all. *(This paragraph said 2.5 until 10 Sep,
contradicting the portable section below, which had 2.7 right.)*

The two-device branch/site contract below records the branch discipline. Its
site half is dormant: there is no site to deploy to, and a green test run was
never authorisation to release in any case.

---

## 1. What this is

A Node.js web app for oil, gas and water well engineering:
nodal analysis, minimum connected reserves from early production, and
production forecasting. It is a **faithful port of the M. El-Ashry Excel
toolset** — the author's tuned correlations and workflows are preserved
exactly; the spreadsheet macros are replaced by deterministic solvers.

The governing rule of the project: **the tested Excel workbooks are the
specification.** Where the port departs from a workbook it is a deliberate,
documented decision, not an improvement of the engineering. The two standing
deviations are an explicit Brill & Beggs Z-factor and Brent root-finding in
place of GoalSeek loops. Both are recorded in the manual under *Workbook
deviations*.

~8,900 lines of JavaScript across 6 core domains (`pvt`, `vlp`, `ipr`,
`nodal`, `reserve`, `solvers`), 35 test files.

## 2. Running it

```bash
npm ci
node src/server/server.js     # http://localhost:3355
```

The web server uses Node built-ins plus `pg` for opt-in PostgreSQL. The UI is
plain HTML/JS. Plotly is the single external asset, from a CDN.

```bash
npm test                          # 345 unit, regression and security tests
node scripts/validation-sweep.mjs # 43 physics checks against analytic answers
```

**Both must pass before any deploy.** The tests are not decoration: many pin
individual workbook cells to 15 digits, and they are the only thing standing
between a refactor and a silently wrong reservoir answer.

One development trap worth knowing: **Node caches modules**, so the dev
server must be restarted after editing anything under `src/server/` or
`src/core/`. A stale server returning old numbers looks exactly like a
physics bug.

## 3. Deploying

**There is nowhere to deploy to.** wellsim.app is retired and WellSim no
longer runs on the Hetzner box; see the retirement record at the top. The
deliverables are a local run and the portable exe.

When a new domain is stood up, **[deploy/README-server-rebuild.md](deploy/README-server-rebuild.md)**
is the rebuild order — captured from the live box before it left, including
the containment check that must pass before DNS points anywhere.
**[docs/deploy.md](docs/deploy.md)** still describes the deploy METHOD
accurately (the tar deploy never deletes files; `data/` survives only because
of that); only its host is gone.

The one rule that is easy to forget: **bump the asset stamp in
`src/ui/index.html` whenever `app.js`, `style.css` or `index.html` changes**,
or returning users get a cached bundle.

## 4. Where things live

```
src/core/pvt/        oil & gas PVT correlations (sour pseudo-criticals, Brill & Beggs Z)
src/core/vlp/        wellbore marches — oil/water (modified Griffith), gas (Gray),
                     water injector (downward march, Ramey temperature), ESP stack
src/core/ipr/        Darcy / Vogel / Jones / C&n inflow, oil-gas-water
src/core/nodal/      operating point (Brent), sensitivity families
src/core/reserve/    oil-reserve (Havlena-Odeh, static MB, reservoir limit)
                     gas-reserve (p/Z solver, SITHP march, gauge p/Z, reservoir limit, forecast)
                     tarner.js, walsh.js (the two oil forecast methods)
src/core/solvers/    Brent, bracketing
src/core/allift/     artificial-lift SELECTION (not design): limits.js is the
                     global, version-stamped 5-method x 8-parameter screening
                     matrix, screen.js the life-of-well envelope screen plus the
                     well-condition gates, economics.js the UDC screen. No
                     physics of its own — Qgross reuses the composite Vogel
src/server/api.js    every endpoint; the UI's only contract. TWO sensitivity
                     paths by design: oilSensitivity / gasSensitivity solve every
                     VLP set at the CURRENT Pr (all fluids, all lift types), and
                     oilEspSens solves an ESP FULLY at each future Pres
                     (0.9/0.8/0.7 x Pr) — the one place a pump is solved on a
                     depleted reservoir
src/server/server.js static file serving, security headers, case database, auth
src/ui/              index.html · app.js · style.css · help.html (the manual)
docs/                deploy.md · user-guide.md · equations.md
tests/               35 files — workbook cell pins, physics regressions, and
                     docs.test.js, which fails when documentation drifts from
                     the code (stale counts, removed endpoints, an unversioned
                     service worker)
scripts/             validation-sweep.mjs · make-icons.mjs
```

**Not in git, and deliberately so** (see `.gitignore`): `data/`,
`data-backups/`, `oil excel/`, `gas excel/`, `training slids/`, `*.xls*`,
`*.pptx`. The workbooks are the source material and the client cases are
private; neither belongs in a repository. They **are** in the F: backup.

## 5. Operational knowledge that is not in the code

### The server binds loopback, and that was a fix, not a default

Until 9 Sep 2026 `server.listen(PORT)` was called with **no host**, which
binds every interface. Combined with two enabled inbound firewall rules
allowing `Node.js JavaScript Runtime` on **any port on the Public profile**,
that meant: whenever the dev server ran, **any machine on the same network
could reach it — including on an untrusted network.** There is no
authentication in front of this server, `data/` holds real client cases, and
with `WELLSIM_ENABLE_LEGACY_CASE_STORE=1` it would have offered a login form
to that network.

It now binds `process.env.HOST ?? '127.0.0.1'`. Measured after the change:
`127.0.0.1:3355` answers 200 and this machine's own LAN address refuses the
connection. **Exposure is opt-in.** The `Dockerfile` sets `HOST=0.0.0.0`
because a container is unreachable otherwise, and it is the ONLY place that
should. The retired production box proxied `127.0.0.1:3355` from Caddy on the
same machine, so loopback would have been correct there too.

`tests/server.test.js` guards all three facts — the listen call passes a host,
the default is loopback, the portable stays pinned to `127.0.0.1`. The
portable was always correct; only the dev server was not.

**The firewall rules were removed by the owner on 9 Sep**, and verified: no
inbound rule mentions node or wellsim, nothing opens 3355, and all three
firewall profiles remain enabled. So the exposure is closed twice over — the
server binds loopback AND node has no inbound allowance. Re-checked after the
change: `127.0.0.1:3355` still answers 200 (loopback never passes through the
firewall) while the LAN address refuses. **If a future node tool prompts to
"allow access" on a public network, say no** — that prompt is how these rules
appeared in the first place.


- **The legacy company case store is disabled by default.** Its registration
  flow accepted a company slug typed by the registrant, which cannot establish
  company membership. `WELLSIM_ENABLE_LEGACY_CASE_STORE=1` is an explicit
  compatibility switch only; even then registration also requires a non-empty
  `WELLSIM_INVITE`. Do not enable it publicly as a substitute for the v2
  organization/membership model. Visitor calculations and Save as / Open are
  unaffected, and the portable build continues to use its local case folder.
- **`data/` is the only stateful thing in the entire application.** It holds
  `users.json` and the company case store, and is not in git. The deploy does
  not touch it and nothing else will recreate it.

  **THE NIGHTLY SERVER BACKUP NO LONGER RUNS.** It ran on the Hetzner box until
  8 September 2026 — `wellsim-backup.timer` (systemd, 02:30 UTC, 30 days kept)
  running `/usr/local/bin/wellsim-backup`, which tarred `/opt/wellsim/app/data`
  into `/var/backups/wellsim/`, deliberately outside the app directory so
  re-extracting or wiping it could not take the backups with it. That timer was
  disabled with the retirement. **Nothing is backing up automatically now.**

  What that store held is captured: the final pull and the whole 30-day
  history are in `WellSim-ServerRetirement-2026-09-08` on **D: and F:**,
  11/11 checksums OK on both — 4 accounts across 2 companies (bapetco, bap)
  and 8 saved client cases, every one read back and confirmed to parse. The
  workstation's own `data/` is AHEAD of that capture (gas-lift-oil and gas-test
  were re-saved locally on 2 Sep with newer fields), so restoring the archive
  over it would roll those back.

  **THE PASSWORD HASHES ARE GONE FROM THIS WORKSTATION (9 Sep 2026).** Four
  people's salted hashes sat in `data/users.json` with the account store
  disabled and the site retired — credential material with no remaining
  purpose. Deleting that one file would have achieved nothing: **there were
  14 copies**, one live and thirteen more in `data-backups/`, one per dated
  snapshot plus the pre-restore set. All 14 are deleted. **The 8 client cases
  were not touched** — they live in `data/cases/`, separate from the hashes,
  and 73 case files remain. Verified afterwards by restarting: the server
  starts clean without the file, `/api/accounts/status` still reports
  `enabled:false`, the page returns 200, 38/38 smoke checks pass and no
  console error appears.

  **And on 10 September they were taken out of the archives too.** The
  9 Sep count of "14 copies" covered the working folder only. A sweep of both
  drives found the same four hashes in **about 54 folders** — every
  full-backup and handover folder that had been copied forward, the
  retirement capture, the recovery kit, two pre-rename `petrosim_*` backups
  (one different account, `engineer1`), 25 loose `users.json` files, and
  33 more inside tarballs, including 14 per drive nested *inside* the
  retirement capture's nightly-history archive where a flat listing could not
  see them. All of it is gone: 46 backup folders and 4 old handovers pruned,
  the loose files deleted, and the 9 remaining archives unpacked, purged
  recursively and repacked with their manifests corrected (the retirement
  capture carries a `STRIPPED-2026-09-10.txt` saying so). **Verified by a
  nested-aware scan of every `.tar.gz` on D: and F:: 0 copies in 41 archives,
  0 loose.** The two drives' recycle bins could not be read and are the one
  place not checked. Re-enabling the legacy store now would find no users and
  no way to register one, which is the intended state. Deleting a hash is not
  revoking a password: anyone who reused theirs elsewhere is unchanged by this.

  **The protection now is manual and yours.** Local `data/` and `data-backups/`
  sit on the same disk as the thing they protect — they survive a bad write,
  not a lost machine. The full-project backups to D: and F: are the off-machine
  copy, and they only exist when someone takes one. The script and units are
  preserved in `deploy/` so the timer can be reinstated verbatim on a new box.
  See also **docs/architecture/infrastructure-audit-2026-09-02.md**.
- **Sessions are in-memory.** Any restart signs users out. Cases on disk are
  unaffected. This is fine and expected; do not treat it as a bug report.
- **PostgreSQL 16.15 is installed for the `bldrz.net` comparison environment.**
  It listens only on `127.0.0.1:5432`; IPv6, wildcard/public listeners and a
  UFW rule for 5432 are absent. The separate `bldrz` database has migrations
  `0001` through `0003`, non-login owner `bldrz_migration_owner`, login
  `bldrz_app`, and non-login least-privilege role `bldrz_runtime`. Native tests
  proved cross-company read, modify, link and export isolation. The credential
  is only in `/etc/bldrz/postgresql.env` (`root:bldrz`, `0640`). The bldrz service
  loads it into a maximum-10 connection pool, with a 50-request admission cap,
  5-second acquisition timeout and 15-second statement timeout. Startup checks
  fail closed on unsafe role privileges. No authenticated v2 data route is
  exposed yet. A manual encrypted off-server PostgreSQL backup and fresh-
  cluster restore drill passed, including data equality, ownership, ACLs and
  two-company isolation after recovery. Identity integration and automated
  off-server retention/alerts/key redundancy remain gates. The new bldrz
  backup timer is deliberately not enabled yet. See
  **docs/architecture/bldrz-recovery.md**.
- **Charts are drawn by Plotly at their container's width**, and that width is
  often wrong at draw time — the container is hidden, or its flex layout has
  not settled, or the web font has not loaded. This caused a long tail of
  "overlapping chart" reports. Every chart therefore goes through `plot()` in
  `app.js`, which applies three **measure-after-draw** corrections in order,
  each a no-op when nothing is wrong:

  1. `fitChartWidth` — canvas vs its container (a chart drawn wider than its
     box laps the results table beside it),
  2. `fitChartTitle` — title vs canvas (shrink, then wrap at the em dash),
  3. `fitChartLegend` — legend vs the x-axis title (grow the bottom margin).

  `refitCharts()` re-runs all three over every visible chart and is wired to
  fonts-ready, window load, resize and orientationchange. **It was dead code
  until 30 Aug 2026** — defined but never called — which is why reloads used
  to show a size jump a second or two in. If charts ever look wrong, start
  with these four functions rather than the physics.
- **Chart ROWS are a pure function of state, not a side effect.**
  `applyOilRows()` derives every oil chart row from (module, lift, pump mode,
  ESP view); the module/lift/ESP-view switches all call it. It replaced
  visibility being set independently in four places, which repeatedly left
  rows stranded — most visibly, leaving the ESP Sensitivity view hid the
  nodal and wellhead charts for every other lift. Add new rows there, not in
  a switch.
- **The UI autosaves to localStorage** (`wellsim.session.v1`) using the same
  collectCase()/applyCase() serialisation as Save as / Open, and restores
  BEFORE the first solve so the startup run uses the restored case. Every
  storage access is guarded — private mode and blocked site data must degrade
  to "start from defaults", never to a broken app. Header **Reset** clears it.
- **The service worker is version-pinned to the asset stamp.** `sw.js` caches
  HTML network-first and never touches `/api/`, so a deploy is picked up
  immediately and no calculation is ever served from cache. A worker whose
  cache key did not move with the stamp would pin users to an old bundle —
  docs.test.js asserts the two match. Note app.js runs at the end of body, so
  registration checks `document.readyState` rather than waiting on `load`,
  which has usually already fired.
- **There is a second deliverable: `WellSim.exe`**, a single-file desktop
  build of the same app (Node SEA). `npm install && .\build.ps1` produces it
  from committed source; the outputs (`WellSim.exe`, `build/`) are gitignored
  because they are ~200 MB per build. It serves the identical UI and physics,
  stores cases in a `cases/` folder **beside the exe**, has no accounts, and
  takes the first free port from 3355. Current: **build 2.7, 9 Sep 2026**,
  from commit `8423d73`, signed `CN=M. El-Ashry`, at `D:\WellSim_2.7\` and
  `F:\WellSim_2.7\` — exe, bare zip, distribution zip, both hash records and
  the certificate. **With the site retired this is the deliverable.**

  **2.5, 2.6 and 2.7 are the SAME PROGRAM.** Nothing in `src/`, `portable/`,
  `build.ps1` or `sea-config.json` has changed since `9025968`; the commits
  between are the retirement, the credential clearance and the records of
  both. They are three different FILES because every build takes a fresh
  signature, timestamp and base `node.exe` — **no two builds of identical
  source produce the same bytes.** The version number tracks the file, not
  the program, and 2.5's and 2.6's binaries no longer exist. Check any exe
  against the `.sha256.txt` bearing its own number; the others are history,
  never targets.

  2.7 was **verified by running it**, not by trusting the build log: with the
  dev server stopped so the exe was the only listener, the project's own
  smoke suite passed **38/38** against the binary — oil nodal, ESP coupling,
  gas lift, the reserve solvers, Tarner and Walsh, gas p/Z, condensate
  properties, water injectivity — and it serves `/vendor/plotly.min.js` with
  no CDN reference.

  **2.6 is a REBUILD of 2.5, not a new version.** Nothing in `src/`,
  `portable/`, `build.ps1` or `sea-config.json` changed between `9025968` and
  `615c972`; the commits between are the retirement and the credential
  clearance. It exists because on 9 Sep every portable was deleted from both
  drives — 1.0 through 2.5, the build folders and the copies inside all 26
  dated backups, about 4.5 GB — and this replaced them from the same source.
  Its hashes cannot match 2.5's: a fresh signature, timestamp and base
  `node.exe` make a different file. Both `.sha256.txt` files record what
  shipped; neither is a target.

  Rebuilding is a command, not a reconstruction — `npm install` then
  `.\build.ps1`. What it needs survived on purpose: `CN=M. El-Ashry` in
  `CurrentUser\My` with its private key, its backup at
  `F:\key\M-ElAshry-CodeSigning.pfx`, and `portable/main.js` — **committed
  source, not a build output**, and the file that makes the exe serve the
  vendored Plotly instead of the CDN. The folder name invites deleting it;
  don't.

  **The exe and a dev server can BOTH hold port 3355, and this bites.**
  Measured 9 Sep: `node` binds `::` and the portable binds `127.0.0.1`, so
  the exe's "first free port" check does not see the dev server and takes
  3355 anyway. Which one `localhost:3355` reaches then depends on whether the
  name resolves to `::1` or `127.0.0.1`. If you are testing a source change
  and the page will not budge — or the reverse — check
  `Get-NetTCPConnection -State Listen -LocalPort 3355` before believing
  either. Stop one of them. Builds 1.3–2.0 carry the ThePWF signature.

  **The ThePWF private key was NOT destroyed on 5 Sep, whatever this file and
  README-PORTABLE said for three days.** It had been exported to
  `ThePWF-CodeSigning-BACKUP.pfx` on 27 Aug, and **four passphrase-protected
  copies survived** — one on D: and three on F:, inside the 27 and 28 Aug
  backups. They were found on 8 Sep while clearing server credentials off this
  machine, and **deleted the same day at the owner's instruction**, so the
  claim is true now and was not before. ThePWF is in no certificate store on
  this workstation either. Nothing can sign as `CN=ThePWF WellSim, O=ThePWF`
  again.

  **On 9 Sep the owner went further and had every loose `ThePWF-CodeSigning.cer`
  deleted too** — 81 copies across D: and F:, the public half this file used to
  say must be kept. Builds 1.3–2.0 still carry embedded, timestamped signatures
  naming their signer, but a machine that does not already trust ThePWF can no
  longer be handed the certificate to check them fully. One copy survives
  **inside each 1.3–2.0 release zip**, since removing it there would have
  invalidated each zip's published SHA-256 — extract it from there if it is
  ever needed. Builds 2.1+ verify against `M-ElAshry-CodeSigning.cer`, which is
  kept, and 2.5 was re-checked after the sweep: **Valid, signer
  CN=M. El-Ashry**.
  README-PORTABLE.md records what that does and does not change. The lesson is
  the one the record already had backwards: **"destroyed" is a claim to verify,
  not to assert.**

  Two things about it are easy to get wrong, and both were wrong until
  30 Aug 2026:

  1. **The web app loads Plotly from a CDN; the portable must not.** That
     swap used to be a hand edit to `src/ui/index.html` that existed only in
     the build folder and was never committed, so builds 1.0 and 1.1 were
     offline-capable *by accident* and the next clean-checkout rebuild would
     have shipped an exe with the whole UI and no charts. It is now done at
     serve time in `portable/main.js`, and docs.test.js asserts both the
     rewrite and that the vendored Plotly version equals the version
     index.html asks the CDN for.
  2. **The portable must not register the service worker.** It takes the
     first free port, so consecutive runs can be different origins, and a
     worker would strand itself and a cache on every port ever used.
     Registration is neutered in the served index.html.

  Both fixes live in the portable alone — the website's CDN tag and service
  worker are correct for the website and are untouched. Verify a build by
  running the exe and checking the page loads `/vendor/plotly.min.js`, not
  the CDN.
- **Server credentials were cleared off this workstation on 8 Sep 2026**, at
  the owner's instruction, after the retirement. Deleted: the SSH key
  `~/.ssh/wellsim_hetzner` and its `.pub`, its F: backup copy, `known_hosts`
  and `known_hosts.old` (which held nothing but that box), and the key's
  identity in the Windows ssh-agent. The owner then deleted the two token
  files `d:\hetzner_token.txt` and `d:\wellsim_token.txt` by hand — agent
  tooling refuses to remove files at a drive root. `d:\github_token.txt` had
  already gone and nothing depends on it; `git push` uses the credential
  helper.

  **Verified after: `~/.ssh` holds no files, the ssh-agent has no identities,
  and no token-, secret- or credential-named file remains at the root of
  either D: or F:.** There is no longer any means on this workstation of
  reaching that server or either API.

  **Deleting a credential is not revoking it.** Both tokens and the
  `wellsim-deploy` key remain valid — at Hetzner, at Cloudflare and in the
  box's `authorized_keys` — they are simply no longer held here. What each one
  reached, checked before deletion: the **Cloudflare** token saw one zone,
  `wellsim.app`, now empty, so it commands nothing. The **Hetzner** token
  controls one server, `wellsim` at `91.98.23.255`, **still running and still
  serving thepwf.net and bldrz.net** — that token is full control of a live
  machine, and revoking it in the Hetzner console is the step that actually
  closes it.

  **From this workstation that box is now reachable only through the Hetzner
  web console.** Two other keys remain authorised on it —
  `wellsim-ops-2026-09-02` and `wellsim-other-device-2026-09-03` — on other
  devices.

  **A tooling trap worth knowing, because it produced a false alarm on 8 Sep:**
  an agent's sandboxed shell refuses to see or read files whose names look
  like secrets. `ls` reported *No such file or directory* for
  `d:\wellsim_token.txt` and a recursive search returned nothing, which was
  read as "the tokens are gone" and briefly written into this file. It was
  wrong — the deny looks exactly like an absence. **Confirm from an ordinary
  shell before concluding a secret has been lost**, and never work around the
  refusal by pasting a token into a chat or a terminal recording; anything
  that has been pasted must be rotated. They are never committed and never
  printed. The server accepts SSH keys only; the private key is
  `~/.ssh/wellsim_hetzner`. The root password file `d:\ssh pass` written
  during setup was **deleted on 29 Aug 2026**, and no rotation was needed:
  on the server `root` carries no password hash at all (`!*` in
  `/etc/shadow`) and `wellsim` is locked, so **no account on the box can be
  logged into with a password**. `PermitRootLogin without-password` enforces
  the same for root at the sshd level.

  Password authentication was **switched off on 29 Aug 2026**. The auth log
  had accumulated ~39,500 failed password attempts from internet background
  scanning; none could ever have succeeded, but sshd was processing them.
  `sshd_config` only had the directive commented out, so `yes` was sshd's
  compiled-in default rather than a deliberate setting. The fix is a drop-in
  rather than an edit to the shipped file, so a future `openssh-server`
  upgrade cannot quietly revert it:

  ```
  /etc/ssh/sshd_config.d/99-hardening.conf
      PasswordAuthentication no
      KbdInteractiveAuthentication no
  ```

  Drop-ins win because `Include /etc/ssh/sshd_config.d/*.conf` sits at line
  12 of `sshd_config` and sshd takes the **first** occurrence of a keyword.
  Applied with `sshd -t` validated first and `systemctl reload ssh` (not
  restart, so live sessions survive); verified afterwards by a fresh key
  login and by confirming the server now answers
  `Permission denied (publickey)` to a password-only attempt. The original
  file is backed up at `/root/sshd_config.bak-2026-08-29`.

  **2 Sep 2026, SINCE REVERSED: `wellsim_hetzner` was unauthorised for three
  days.** Key-only administrative access was restored through the Hetzner
  console that day and a new Ed25519 recovery identity was installed
  (`wellsim-ops-2026-09-02` in the Hetzner project). With `wellsim_hetzner`
  out of `authorized_keys` the server answered `Permission denied (publickey)`
  to it — verified from this workstation on 2 Sep, with no `Server accepts
  key` line — and deploys could not run from here.

  **It was re-added through the Hetzner console on 5 Sep 2026 and works
  again.** Same key, same fingerprint `SHA256:/3IAf9gT…`; it was never
  "retired", only unauthorised. Verified from this workstation on 5 Sep:
  `Server accepts key` followed by `Authenticated to 91.98.23.255 using
  "publickey"`. Three keys now open root — `wellsim-deploy`,
  `wellsim-ops-2026-09-02`, `wellsim-other-device-2026-09-03` — and none are
  to be removed. docs/deploy.md carries the same account plus the Windows
  gotcha that costs the most time: Git Bash's `ssh` cannot see the Windows
  ssh-agent, so use `C:\Windows\System32\OpenSSH\ssh.exe`. Everything below
  therefore describes the key still in use.

  See **docs/architecture/infrastructure-audit-2026-09-02.md** for why.

  **That key no longer exists on this workstation.** It and its F: backup were
  deleted on 8 Sep 2026 with the rest of the server credentials — see the
  Secrets entry above. The host still accepts no passwords, so **from here the
  box is reachable only through the Hetzner web console.** The notes left in
  `F:\WellSim-Backup-2026-08-29\ssh-key\` describe a key that is gone; they are
  kept as history, not as a recovery path. Everything below this line is the
  record of how that key was handled while it existed, and is retained because
  the same traps apply to whatever key a future box uses.

  **Recovered once, on 31 Aug 2026** — a new Windows account had no `~/.ssh`
  at all and the `d:\*.txt` token files had been deleted. What that taught:

  - This entry used to say the copy was at a bare `F:\ssh-key`. It is not;
    it is inside the dated backup folder above. A wrong path in a recovery
    procedure costs an hour exactly when you have none.
  - The restored key is **encrypted (`aes256-ctr`)**, so it prompts for the
    passphrase on every use. The "working copy stays passphrase-free" state
    this file used to describe is something you have to RE-CREATE after a
    restore: `ssh-keygen -p -f ~/.ssh/wellsim_hetzner` on the LOCAL copy
    only (leave the F: copy protected), or `ssh-add` it per session.
  - Windows needs the ACL tightened or OpenSSH refuses the key:
    `icacls %USERPROFILE%\.ssh\wellsim_hetzner /inheritance:r /grant:r "%USERNAME%:(R)"`
  - Verify without logging in: `ssh -v -o BatchMode=yes -i <key> root@<ip> true`
    prints **`Server accepts key`** when the key is still in `authorized_keys`.
    The `Permission denied (publickey)` that follows is only the unsupplied
    passphrase — not a rejected key. That one line is the whole test.
  - The two API tokens survived ONLY as WhatsApp transfer-cache copies, i.e.
    they had been sent through a chat. They were restored to keep work
    moving and are due for rotation (see Credentials in docs/deploy.md).
- **The code-signing PFX** and its password are for the desktop distributable.
  The PFX must not ship inside any distributed zip, and the password belongs
  in a password manager, not a file.

## 6. Known gaps — accepted, not oversights

These were each raised, discussed and consciously deferred. They are listed
so nobody rediscovers them as surprises.

**Water injector** (all four acknowledged by the author):
1. ~~No fracture / formation-parting limit~~ — **closed 30 Aug 2026**: a
   fracture-gradient input gives the parting pressure and the THP that lands
   on it. The gradient is an INPUT because it belongs to the rock (step-rate
   or leak-off test); no correlation here can predict it.
2. Injected-water temperature affects the bottom-hole temperature only; it
   does not feed back into viscosity along the march.
3. Skin is static — no fall-off-derived or time-dependent skin.
4. No surface-pressure ceiling — no pump or wellhead rating is enforced.

**Gas reserve, memory-gauge method:** ~~datum correction descoped~~ —
**closed 30 Aug 2026.** A *Gauge TVD* column corrects the reading through the
static gas column between gauge and perforations (`gaugeToDatum()`, reusing
the SITHP average-T&Z correlation), reporting the correction in its own
column. A blank depth keeps the previous behaviour of trusting the entered
value, so existing cases are unaffected.

**Oil forecast:** the material balance has no water-production term, so the
Forecast W.C affects lift only, never the balance. On a high-water-cut well
that is a real modelling limit, not a rounding issue.

**Demo data self-consistency:** the demo oil well carries a measured GOR of
5000 scf/stb against an Rsi of 700 at a pressure above the bubble point. The
material balance cannot reproduce that, so MB-derived and measured GOR
diverge sharply on the demo case. Real, consistent data does not show this.
Worth remembering before chasing it as a bug.

## 7. If you change the physics

1. Find the workbook cell it comes from. The workbooks are in `oil excel/`
   and `gas excel/` in the backup.
2. Pin it with a test at 15 digits, the way the existing tests do.
3. Run `npm test` **and** `node scripts/validation-sweep.mjs`.
4. Verify in the browser — the app is the deliverable, not the API.
5. Only then deploy, and bump the asset stamp.

## 8. Contact

**M. El-Ashry — muhamad.elashry@gmail.com**
