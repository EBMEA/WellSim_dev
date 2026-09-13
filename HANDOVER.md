# WellSim — handover

**Live:** **[https://wellssim.app](https://wellssim.app)** (note the DOUBLE s) — Spaceship
shared hosting, cPanel/LiteSpeed/Passenger, Node 24.20.0, deployed commit `f98817e` ·
**Repo:** https://github.com/EBMEA/WellSim_dev ·
**Manual:** `src/ui/help.html` (served at /help.html) ·
**Codex comparison:** https://bldrz.net

**Where it stands, 13 September 2026.** `main` is at `f98817e`, 213 commits, working
tree clean, **344/344 tests passing** and the sweep **43/43 PASS**. The repository, the
live site and this workstation all describe the same product:

| | commit | note |
| --- | --- | --- |
| `wellsim-dev/main` (GitHub) | `f98817e` | default branch, **public** |
| https://wellssim.app | `f98817e` | verified from outside, not from the console |
| `D:\WellSim-FullBackup-2026-09-13` | `f98817e` | bundle cloned back, tree matches |
| `D:\WellSim_2.8` (portable exe) | `768d4d1` | **one commit behind, on purpose** |

The portable is the only thing not at `f98817e`: build 2.8 predates the water-well UI
work by one commit. Its physics is identical; only its embedded UI is older.

**Three deliverables, not one.** The website, the portable exe, and a local run
(`npm start`, http://localhost:3355) are the same app. The portable needs no domain
and no account, and is what goes to a client on a USB stick.

---

## 13 September — the water well tab

One commit, `f98817e`, six user-interface changes. **No physics moved**: every solved
answer matches the build before it.

- **FTHP kept losing its "psi", and the schema was never at fault.** `relabel()`
  assigned `label.textContent`, which deletes the label's children — including the
  `<span class="unit">` inside it — so the unit vanished the first time a well-type
  switch ran and never came back. It now replaces only the label's own text node.
  That fixed **four** fields: FTHP / Injection THP and the three test-block labels.
- **Test water rate follows the lift.** An unlifted water well solves near 1836 bbl/d
  and an ESP well near 4329, so one default cannot suit both: 2000 on natural and gas
  lift, **4300 on ESP**, 2000 again on an injector. It is exchanged only while the
  field still holds the other default, so a typed value is never overwritten.
- **Measured Pint / Pdis (4000 / 4850 psi) are now inputs** on the water ESP block,
  with *Design min intake P* at 300 psi beside them. This closed a UI gap, not a
  physics one: `oilMatchHead` has read `espMeasPintPsi` / `espMeasPdisPsi` all along
  and REFUSES an ESP match without them, so that button could never have succeeded on
  a water well.
- **A wear match was added**, mirroring the oil tab (`oil/espwear`). There is
  deliberately **no separator-efficiency match**: water carries no free gas, free gas
  at intake reads 0%, and `oil/espsepeff` returns *below-range* here. The markup says
  so, so nobody restores it later thinking it was an oversight.
- **The water ESP match buttons were invisible, and always had been** — the stages
  button too, which is why nobody had ever seen it. `switchWaterEspPump()` clears the
  row's authored `display:none` and was called from the pump dropdown only, where
  oil's equivalent is called in four places. Worse, the CATALOGUE select installs one
  handler for both tabs and always called the OIL switch, so picking a water catalogue
  could never reveal the water row.

**An injector keeps whatever its lift radio last held**, so every one of these checks
gates on WELL TYPE first and lift second. Getting that order wrong left an injector
showing an ESP test rate and a gas-lift SG field.

## 13 September — backup, and the gap on F:

`D:\WellSim-FullBackup-2026-09-13`, sealed at `f98817e`, 187 MB, **44/44 checksums
OK**. The bundle was cloned back as a restore drill: `main` at `f98817e`, 213 commits,
tree `2f9ffc1` identical to the working copy, and `npm test` 344/344 plus the 43/43
sweep run **inside the restored clone**, not in the original.

***F: HAS BEEN DETACHED SINCE 10 SEPTEMBER.*** It holds a clean verified copy as of
`1d261be` and nothing since — four backups' worth of work with no second copy,
including both portable builds and every case saved since. The SOURCE is safe three
ways over (GitHub, the live server, here); what lives **only on D:** is the workbooks,
the ESP catalogue, ALdocs, the client cases and the portable binaries.

## 12–13 September — the IP separation

The owner asked to remove another contributor's work from the public repository, for
legal/IP separation. What was done, and what was **not**:

- **Dropping the commits was measured and rejected.** The 15 commits by `aleimam` are
  non-contiguous and 103 of the 115 later commits conflict with their removal. Worse,
  one of them is `27ea04e` — the containment gate itself — so a history rewrite that
  dropped them would have reopened public registration on a live site. That is why the
  history still carries the name. **`pre-author-rewrite-2026-09-12` tags the state
  before this work began.**
- **The content was replaced instead, clean-room.** `docs/specs/export-contract.md`
  and `docs/specs/case-portability-and-account-gate.md` were written as normative
  specifications from untainted sources, the architecture documents were deleted, and
  `src/ui/export.js` and the account gate in `src/server/accounts.js` were
  reimplemented from those specs.
- **Measured afterwards with `git blame`, not asserted.** `src/ui/export.js` went from
  **369/369** lines attributed to `aleimam` to **108/338**; `tests/export.test.js` from
  140/140 to 56/178. Repo-wide the surviving share is **633 of 26,354 lines**, and 158
  of those are generated `package-lock.json`. The residue is real and is mostly
  declarative: format tables, constant names and function signatures that the contract
  itself dictates. **Attribution by blame is not the same as copied expression**, and
  this file records the number rather than a claim of a clean sweep.
- The dormant PostgreSQL foundation — `db/`, `src/server/database.js` and their tests —
  was **removed** in the same pass. It was never enabled in production
  (`WELLSIM_DATABASE_ENABLED` was never set) and the fourteen checks covering it went
  with it. A side effect worth knowing: **that removal took the last top-level `await`
  out of the server graph.**

The account gate was rewritten around one wrapper — `caseStoreEnabled()`,
`registrationOpen()`, `storeShut()` and a `gated(handler)` applied at the export
boundary — with `tests/account-gate.test.js` covering it by switch combination.
`accountStatus` is deliberately **un**gated, because a caller must always be able to
learn that the store is shut.

## 12 September — portable 2.8, and the march defaults

**Nine fields stopped being editable.** They are the marches' own constants, not
properties of the well in front of the analyst:

```
oil    Roughness · Oil viscosity (tubing) · Water SG · Cp
water  Roughness · Cp
gas    Base roughness · Cond. viscosity · Surface tension · Cp
```

They are marked `'fixed'` in the form schema and render as **hidden inputs rather than
being deleted**, and that distinction is the whole point: the schema drives both the
form and the payload, because `collect()` reads every field back out of the DOM by id.
Deleting an entry would have stopped the value reaching the solver and quietly changed
every answer. As hidden inputs they still collect, save, export and round-trip.

Proved still live rather than trusted: perturbing the hidden gas roughness to 0.05
moved the rate 13.38 → 12.72 MMscf/d, and restoring it returned exactly 13.38.

**Lift-gas SG is conditional, not hidden.** It describes the injected gas, so it shows
on the water well only while that well is actually gas lifted, and never on an
injector. *A trap when re-testing it:* at the demo well's default injection rate of
ZERO the gas gravity cannot affect anything, and a first check wrongly suggested the
field was dead. Inject 1.5 MMscf/d and the well goes 1836 → 5112 bbl/d; SG 1.2 then
moves it to 4678.

**Portable 2.8** was built the same day from `768d4d1`, signed `CN=M. El-Ashry`,
Authenticode Valid, DigiCert timestamped, at `D:\WellSim_2.8\`. Verified by RUNNING
it, not by trusting the build log: 38/38 module smoke against the exe, and the page
asks for `/vendor/plotly.min.js` and gets all 4.4 MB from the exe, so it charts
offline. 2.7 is superseded but still on disk.

One difference that looks alarming and is not: the portable reports
`{"enabled":true,"registrationEnabled":false,"mode":"portable"}` while the website
reports `{"enabled":false,…,"mode":"legacy-web"}`. The portable's *enabled* refers to
its OWN `cases\` folder beside the exe, not the web account store. **The web
containment is not weakened; they are different stores.**

## 12 September — WellSim went live at wellssim.app

Verified from outside, and re-verified at the 13 September capture:

- Certificate **Let's Encrypt**, SAN `wellssim.app` + `www.wellssim.app`, valid to
  10 Dec 2026, full chain OK. Two self-signed certificates were generated in cPanel
  before the real one issued; both are gone.
- The deployed `app.js` is **byte-identical** to this workstation's once line endings
  are normalised — 220,525 bytes both, the raw 4,522-byte gap being exactly one byte
  per line, CRLF here against LF on the Linux checkout.
- **Containment holds:** all seven account endpoints refuse with
  `legacy_case_store_disabled`, and `/api/accounts/status` reports
  `{"enabled":false,"registrationEnabled":false,"mode":"legacy-web"}`.
- **38/38 module smoke** against the live URL — every module, both fluids, both lift
  types, the injector, the forecast.
- Headers: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.

**Where it runs, and the choice behind it.** The owner chose **Spaceship shared
hosting** over a Hetzner VPS: cPanel on LiteSpeed at `66.29.148.162`
(`server52.shared.spaceship.host`), the app under CloudLinux Node.js Selector /
Passenger, **Node 24.20.0** — the same version as this workstation. Application root
`/home/solmuygadd/wellsim`, URL at the domain root, startup file **`app.cjs`**. The
runbook is `deploy/SHARED-HOSTING-wellssim.md`; the VPS files stay in `deploy/` as the
path back.

**Two things that went wrong on the way, both worth knowing:**

- The app was first mounted at `/wellssim.app/` (a subpath) with the domain root
  serving a directory listing. The UI is written for the root — absolute `/api/…`,
  `/app.js`, a service worker at `/sw.js` — so a subpath mount boots and then cannot
  load itself. Fixed by setting Application URL to the bare domain.
- The first real deploy answered **503 on every path.** Passenger `require()`s the
  startup file, and Node cannot `require()` an ES module whose graph carries a
  top-level `await` — ours had one at `src/server/server.js:15`. The ESM `app.js` was
  replaced by **`app.cjs`** (CommonJS, dynamic `import()`); the failure was reproduced
  and the fix verified locally on the same Node before redeploying.
  `deploy/SHARED-HOSTING-wellssim.md` had said "must stay ESM" — the wrong half of the
  truth, now corrected.

**Still true on this host:** `data/` is empty — no client cases were uploaded, by
decision, pending the shared-hosting risk note in the runbook. **No nightly backup
cron exists.**

## 11 September — the domain, and the box that was never built

The owner bought **`wellssim.app`** from Spaceship. The retired name is `wellsim.app`,
single s, still registered and still empty at Cloudflare.

**`.app` is on the HSTS preload list.** Browsers force HTTPS for it with no
click-through, so there is no http-only state to test in and a parking page is
invisible in practice.

**The Hetzner plan was prepared and then not taken.** `deploy/cloud-init-wellssim.yaml`
still builds a CX22 from user-data, pinned to an exact commit, aborting the boot on
mismatch and leaving Caddy stopped until DNS moves. It is the path back if shared
hosting disappoints — nothing more. **Rotating the two API tokens was listed as the
first step of that plan and has still not happened** (see *Still open*).

## 10 September — the backups, the pruning and the hash sweep

- The backup series was **pruned to three** and the handovers to one, on both drives —
  46 + 4 folders deleted, ~2.7 GB freed per drive. Two things that existed *only* in
  the pruned folders were rescued first: the **build hash records for portables
  1.3–2.5** (`portable/build-records-1.3-2.5/`, the only surviving proof of what those
  now-deleted binaries were) and the **5 Sep evening handover addendum** (`records/`).
  The one real loss: intra-day server pulls from 5–8 Sep; the retirement capture keeps
  one per day and the final pull.
- **The password hashes were taken out of the archives.** The 9 Sep claim of "14
  copies" covered the working folder only. A sweep of both drives found the same four
  hashes in **about 54 folders** — every backup and handover folder copied forward, the
  retirement capture, the recovery kit, two pre-rename `petrosim_*` backups, 25 loose
  `users.json` files, and 33 more inside tarballs, including 14 per drive nested
  *inside* another archive where a flat listing could not see them. All of it is gone,
  verified by a **nested-aware scan: 0 copies in 41 archives, 0 loose.** The recycle
  bins are the one place not checked. **Deleting a hash is not revoking a password:**
  anyone who reused theirs elsewhere is unchanged by this.

## 8–9 September — wellsim.app (single s) was retired

The single-s domain is gone and WellSim no longer runs on the Hetzner box. Each step
was verified: the final `data/` pull was taken and **read back** (4 accounts, 8 cases,
every one parsing) into `WellSim-ServerRetirement-2026-09-08` on D: and F:, 11/11
checksums OK on both; the Caddy blocks were removed after `caddy validate`; the systemd
units were disabled and then deleted; `/opt/wellsim` and `/var/backups/wellsim` were
moved rather than deleted so the irreversible step stayed the owner's, and the owner
took it. **WellSim's data is off that machine.** All four unit files are committed
verbatim under `deploy/`, so nothing was lost. The Cloudflare zone held exactly two A
records and no MX, TXT or verification record; **it is now empty.**

**The box lives on and still serves the other two sites**, which were never touched:
thepwf.net and bldrz.net, both verified 200 after the reload. bldrz keeps its own
PostgreSQL database and runtime user.

Two loose ends remain there: the `wellsim.app` **registration** itself (empty zone,
still in the owner's name — letting it lapse is a one-way door, and the brochure and
meeting invite in ALdocs still print it) and the `wellsim` service user (uid 996,
nologin, home `/opt/wellsim` which no longer exists; `userdel wellsim` closes it).

---

## The containment, which binds every host

`/api/accounts/status` must report `{"enabled":false,"registrationEnabled":false}`
before DNS points at any machine. It holds **two ways over**, and either alone would
keep registration closed:

1. the gate commit `27ea04e`, which `main` **contains** (verified with
   `git merge-base --is-ancestor`), and
2. **`WELLSIM_ENABLE_LEGACY_CASE_STORE` absent from the environment** — it is not in
   `.cpanel.yml`, not in the cPanel environment panel, and must never be added there.

Earlier revisions of this file said `main` must not be deployed anywhere because it
lacked `27ea04e`. That was true until the 10 September merge and is not true now.

## The remotes disagree, and it matters which one you reach

| remote | repository | `main` |
| --- | --- | --- |
| `wellsim-dev` | `EBMEA/WellSim_dev` | `f98817e` — **current**, default branch, public |
| `origin` | `aleimam/wellsim` | `de2393c` — far behind, receives none of this work |
| `ebmea` | `EBMEA/wellssim` | `918329e` — unrelated, note the double `s` |

Local `main` tracks `wellsim-dev/main`, so a bare `git push` or `git pull` goes to
`EBMEA/WellSim_dev`. Reaching the other two takes an explicit remote name.

**`EBMEA/WellSim_dev` is public.** Before the first push the whole history on every
branch was scanned for private keys, cloud tokens and inline secret assignments;
nothing was found outside false positives in the vendored `plotly.min.js`. What is
public beyond code was published knowingly: `deploy/` carries real hostnames, the Caddy
config and the systemd units as they ran, and this file narrates the infrastructure in
detail. **None of it is a credential.** The gitignore that keeps `data/`, the
workbooks, the ESP catalogue and `ALdocs/` out of git is what makes that safe, and
`docs.test.js` asserts the git index rather than trusting the ignore rule.

## Still open

- **The Hetzner and Cloudflare API tokens are deleted here but NOT REVOKED.** The
  Hetzner one is full control of `91.98.23.255`, a live server still serving thepwf.net
  and bldrz.net, and `wellsim-deploy` is still in its `authorized_keys`. Revoking them
  in the two consoles is the step that actually closes this.
- **BitLocker on D: and F: is unverified.** Every non-elevated route was refused;
  `manage-bde -status` from an elevated prompt, with both drives present, settles it.
  These drives hold real client cases.
- **Two credential files sit at the D: root** — `d:\wellssim_deploy-2026-09-11` and
  `d:\id_rsa` — on a drive whose encryption is unverified. Agent tooling refuses to
  touch files at a drive root, so removing them is a manual step.
- **F: is four backups behind** (see 13 September, above).
- **The service worker can serve one stale load after a deploy.** `sw.js` precaches the
  BARE paths (`/app.js`, no `?v=`) and matches with `{ ignoreSearch: true }`, so one
  cached entry answers every stamped request — and `cache.add('/app.js')` refetches
  that bare URL through the browser's own HTTP cache, which the server allows to live
  `max-age=300`. **So bumping the asset stamp does not reliably bust the cache within
  five minutes of the previous load.** The `ignoreSearch` is deliberate and is
  documented in `sw.js`; whether the trade is right has not been revisited, and nothing
  was changed. What actually forces a refresh while debugging:

  ```js
  for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  for (const k of await caches.keys()) await caches.delete(k);
  for (const u of ['/', '/app.js', '/style.css', '/export.js', '/sw.js'])
    await fetch(u, { cache: 'reload' });   // refresh the BARE urls
  location.reload();
  ```

  This cost half an hour on 13 September: `curl` showed the server returning the
  correct file the whole time while the page ran a copy 795 bytes shorter.
- **Every published reference to the retired `wellsim.app` still needs one pass** — the
  brochure and the meeting invite in ALdocs still print a name that resolves nowhere.

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
`nodal`, `reserve`, `solvers`), 34 test files.

## 2. Running it

```bash
npm ci
node src/server/server.js     # http://localhost:3355
```

**The server has NO runtime dependencies** — Node built-ins only, since the
PostgreSQL boundary was removed on 12 Sep. The UI is plain HTML/JS. Plotly is
the single external asset, from a CDN on the website and **embedded in the
portable exe**. `esbuild` and `postject` are devDependencies of the portable
build alone, so nothing the server needs is fetched at install time.

```bash
npm test                          # 344 unit, regression and security tests
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

**Deploying needs no shell and no credential.** `.cpanel.yml` at the repository
root drives cPanel’s **Deploy HEAD Commit** button: push to `wellsim-dev/main`,
then press it under cPanel → Git Version Control. The recipe is four lines —
create `tmp/` and `data/`, then `touch tmp/restart.txt`, which is how Passenger
is told to reload.

**THE REPOSITORY MUST BE PUBLIC AT THAT MOMENT.** It was switched to private
twice on 12 September and the deploy broke both times: git prompts for a
username because **GitHub answers 404 rather than 403** to anonymous callers on
a private repo, so it cannot tell "no access" from "no such repo". Making it
public again fixed it immediately. If it must stay private, the server needs its
own deploy key, or the release has to go up through File Manager.

The runbook is **[deploy/SHARED-HOSTING-wellssim.md](deploy/SHARED-HOSTING-wellssim.md)**.
The VPS path back is **[deploy/README-server-rebuild.md](deploy/README-server-rebuild.md)**
plus `deploy/cloud-init-wellssim.yaml`, both carrying the containment check that
must pass before DNS points anywhere. **[docs/deploy.md](docs/deploy.md)**
describes the older tar-over-SSH method, which no current host uses.

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
src/server/server.js static file serving, security headers, case store, auth
src/server/accounts.js  the account gate — one gated() wrapper at the export
                     boundary; accountStatus is deliberately UNgated
app.cjs              the Passenger startup file: CommonJS, dynamic import().
                     Not a build output — committed, and the live site boots
                     through it
.cpanel.yml          the four-line deploy cPanel runs on Deploy HEAD Commit
src/ui/              index.html · app.js · style.css · export.js · sw.js ·
                     help.html (the manual)
docs/                deploy.md · user-guide.md · equations.md
docs/specs/          export-contract.md · case-portability-and-account-gate.md
                     — NORMATIVE. export.js and the account gate were
                     reimplemented from these, not the other way round; change
                     the spec first
deploy/              the runbooks: SHARED-HOSTING-wellssim.md (current host),
                     CUTOVER-wellssim-app.md, cloud-init-wellssim.yaml and the
                     retired box's Caddy config and systemd units, verbatim
tests/               34 files — workbook cell pins, physics regressions, and
                     docs.test.js, which fails when documentation drifts from
                     the code (stale counts, removed endpoints, an unversioned
                     service worker)
scripts/             validation-sweep.mjs · make-icons.mjs
```

**Not in git, and deliberately so** (see `.gitignore`): `data/`,
`data-backups/`, `ESP PUMPS DATA Base/`, `ALdocs/`, `oil excel/`, `gas excel/`,
`training slids/`, `*.xls*`, `*.pptx`, `*.pdf`, and the build outputs
(`WellSim.exe`, `build/`, `node_modules/`). The workbooks are the source
material, the ESP catalogues are vendor property carrying a reproduction
notice, and the client cases are private; none belongs in a repository, least
of all a public one. They **are** in the D: backups — and, four backups out of
date, on F:.

`docs.test.js` asserts this against `git ls-files` rather than against
`.gitignore`, because an ignore rule is a default and not a guarantee: `git
add -f`, a new tool, or a rule edited in good faith all bypass it silently.
That guard caught the brochure PDF being tracked on 12 September.

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


- **The legacy company case store is disabled by default, and the gate was
  rewritten on 12 Sep** around one `gated(handler)` wrapper applied at the
  export boundary, with `caseStoreEnabled()` / `registrationOpen()` /
  `storeShut()` beside it and `tests/account-gate.test.js` covering every
  switch combination. `accountStatus` stays **un**gated on purpose: a caller
  must always be able to learn that the store is shut. Its registration
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
  takes the first free port from 3355. Current: **build 2.8, 12 Sep 2026**,
  from commit `768d4d1`, signed `CN=M. El-Ashry`, at `D:\WellSim_2.8\` — exe,
  bare zip, distribution zip, both hash records and the certificate. **It is
  one commit behind `main`** and carries none of the 13 Sep water-well UI work;
  its physics is identical. 2.7 is superseded but still at `D:\WellSim_2.7\`.
  **Neither is on F: yet.**

  2.8 was **verified by running it**, not by trusting the build log: with the
  dev server stopped so the exe was the only listener, the project's own smoke
  suite passed **38/38** against the binary — oil nodal, ESP coupling, gas
  lift, the reserve solvers, Tarner and Walsh, gas p/Z, condensate properties,
  water injectivity — and the page asks for `/vendor/plotly.min.js` and gets
  all 4.4 MB from the exe, so it charts with no internet at all. That last one
  is the single thing most easily lost in a rebuild, because it depends on
  `portable/main.js` being the bundled entry rather than the plain server.

  **2.5 through 2.8 are near-identical PROGRAMS with different bytes.** Every
  build takes a fresh signature, timestamp and base `node.exe`, so **no two
  builds of identical source produce the same file.** The version number tracks
  the FILE, not the program; 2.5's and 2.6's binaries no longer exist. Check an
  exe against the `.sha256.txt` bearing its own number — the others are
  history, never targets. **A rebuild will not reproduce 2.8's hashes**, and
  will fold in the water-well work.

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

  **Verified on 8 Sep: `~/.ssh` holds no files, the ssh-agent has no
  identities, and no token-, secret- or credential-named file remained at the
  root of either D: or F:.** There was no longer any means on this workstation
  of reaching that server or either API.

  **THAT LAST CLAUSE IS FALSE AGAIN, AND HAS BEEN SINCE 11 SEPTEMBER.** Two
  files were placed at the D: root during the wellssim.app deploy —
  `d:\wellssim_deploy-2026-09-11` and `d:\id_rsa` — on a drive whose
  encryption has never been verified. They are listed under *Still open*.
  Nothing here reads or uses them; removing them is a manual step, because
  agent tooling refuses to touch files at a drive root.

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
4. Verify in the browser — the app is the deliverable, not the API. **Click
   Reset first**: the UI restores its last session from localStorage, so a
   value you typed while testing comes back and masks the default you meant to
   check. That produced two false results on 13 September.
5. Only then deploy, and bump the asset stamp. **Then force a real reload** —
   the stamp alone does not reliably reach a browser that loaded the page in
   the last five minutes; see the service worker note under *Still open*.

`src/ui/export.js` and the account gate are the exception to step 1: they are
governed by `docs/specs/`, not by a workbook. **Change the spec first**, then
the implementation — that ordering is what makes the reimplementation
defensible.

## 8. Contact

**M. El-Ashry — muhamad.elashry@gmail.com**
