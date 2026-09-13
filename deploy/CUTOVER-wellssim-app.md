# Standing WellSim up on `wellssim.app`

**Written 11 September 2026.** This is the launch order for the *new* domain
on a *new* box. It supersedes the DNS and cutover halves of
`README-server-rebuild.md`, which were written on 8 September for a migration
that no longer describes the situation.

## What is different from the runbook next to this file

`README-server-rebuild.md` assumes WellSim is **moving off** the Hetzner box
at `91.98.23.255` while that box keeps serving two other sites, and that DNS
lives at Cloudflare. Neither still holds:

- **There is nothing to migrate.** WellSim was removed from that box on
  8–9 September and the owner deleted `/opt/wellsim` and
  `/var/backups/wellsim` outright. Its systemd units are gone, port 3355 is
  free there, and its Caddyfile names only `thepwf.net` and `bldrz.net`.
  Every step in that runbook's *"Retiring WellSim from the old box"* section
  is **already done**. Do not run it again.
- **The domain is different.** `wellsim.app` (single s) is retired — empty
  Cloudflare zone, does not resolve, registration still the owner's.
  The new name is **`wellssim.app`** (double s), bought from Spaceship.
- **DNS is at Spaceship, not Cloudflare.** Nameservers are
  `launch1.spaceship.net` / `launch2.spaceship.net`. There is no Cloudflare
  zone for this name and no Cloudflare API token on this workstation.
- **The old data is the only data.** There is no live site to take a final
  pull from. The case store to restore is the workstation's `data/`, which is
  ahead of every server capture.

## State at the time of writing, all verified

```
wellssim.app     A 34.216.117.25, 54.149.79.189   (Spaceship parking, AWS us-west-2)
                 :80  → 200, parking page
                 :443 → connection times out, no TLS
                 www  → does not resolve
                 MX / TXT → none
wellsim.app      NS zita/bart.ns.cloudflare.com, zone empty, no A records
```

`.app` is on the **HSTS preload list**. Chrome, Firefox and Safari force
HTTPS for it with no click-through, so the parking page answering on port 80
is invisible in a real browser. The name is effectively dark until Caddy has
a certificate. Plan for that: there is no http-only interim state to test in.

## Before the box: rotate the Hetzner credentials

The API token that controls `91.98.23.255` was deleted from this workstation
on 8–9 September but **never revoked**, and neither was the `wellsim-deploy`
SSH key in that box's `authorized_keys`. That box still serves thepwf.net and
bldrz.net. Creating a new server is the natural moment to close this:

1. Revoke the old token in the Hetzner console.
2. Revoke the Cloudflare token too — it reached the (now empty) `wellsim.app`
   zone and is not needed for a Spaceship-hosted domain.
3. Remove `wellsim-deploy` from `~/.ssh/authorized_keys` on the old box.
4. Issue a **new** token scoped to a new project, and a new SSH keypair for
   the new machine only.

Doing this first also means the new box never shares a credential with the
old one.

## Server

**Hetzner Cloud CX22** — 2 vCPU, 4 GB, 40 GB, Falkenstein or Nuremberg.
The app needs **Node and Caddy only**: WellSim's database boundary is
disabled and the service logs *"PostgreSQL boundary: disabled"* at startup.
`pg` must still be in `node_modules` — the server imports it unconditionally
since `713ce46` and crash-loops without it — but no database server process
is installed. Data footprint is tiny: `data/` is 132 KB, `data-backups/`
1.2 MB.

`CAX11` (ARM, same RAM, cheaper) also works; Node 24 is fine on ARM64 and
nothing server-side is architecture-bound. The Windows portable build is
irrelevant here.

## Build order

Steps 1–10 of `README-server-rebuild.md` still apply as written, with two
substitutions:

- step 5 installs the **updated** `Caddyfile.wellsim`, which now names
  `wellssim.app`. Check that before copying it — a Caddyfile naming the old
  domain will request a certificate for a name that points nowhere and the
  site will not come up.
- step 7 deploys from **`main`**. The old warning that `main` must not be
  deployed is **spent**: `main` contains `27ea04e`, verified with
  `git merge-base --is-ancestor`. It is currently `1d261be`.

Node on the old box was v22.23.2; this workstation runs v24.20.0 and the
suite passes on it. Either is fine.

## Verify before DNS points anywhere

The containment gate must pass on the new box while it is still unreachable
by name:

```bash
systemctl is-active wellsim                       # active
systemctl show wellsim -p NRestarts               # NRestarts=0
curl -s http://127.0.0.1:3355/api/accounts/status # enabled:false,
                                                  # registrationEnabled:false,
                                                  # mode:legacy-web
node scripts/module-smoke.mjs --base http://<new-ip>:3355   # 59/59
```

`enabled:false` must hold **two independent ways**: the code gate `27ea04e`
on the deployed commit, *and* `WELLSIM_ENABLE_LEGACY_CASE_STORE` absent from
`wellsim.service`. Check the unit file, not just the response — the response
alone cannot tell you which of the two is doing the work.

Confirm the server also logs `bound to 127.0.0.1 (this machine only)`. Since
`9943e99` it binds `process.env.HOST ?? '127.0.0.1'`; the Dockerfile is the
only place that opts into `0.0.0.0`. Caddy reaches it over loopback, so
nothing needs to listen on a public interface.

## DNS at Spaceship

1. Delete the two parking A records (`34.216.117.25`, `54.149.79.189`).
2. Add `A wellssim.app → <new-ip>`.
3. Add `A www.wellssim.app → <new-ip>` **or** delete the `www` block from the
   Caddyfile. Do not leave one without the other.
4. There is no CDN in front of this and no proxy toggle to think about —
   Spaceship serves plain DNS, unlike the Cloudflare setup the old site had.

Then watch the certificate issue:

```bash
journalctl -u caddy -f          # wait for the Let's Encrypt order to succeed
curl -sS -o /dev/null -w '%{http_code}\n' https://wellssim.app
```

Re-run the containment check against the live name once it answers. A `.app`
domain that 200s over HTTPS is the first moment the site is genuinely up.

## After it is live

- Watch one full nightly backup cycle (`wellsim-backup.timer`, 02:30 UTC,
  `Persistent=true`) before treating the box as the system of record.
- The nightly snapshot is **plaintext and on-box**. It survives a bad write,
  not a lost machine. `backup-wellsim-data.sh` and its units in this
  directory are the encrypted, off-box design and were never installed on the
  old server; decide deliberately whether the new one runs them.
- Record the new host keys **from the Hetzner console**, not from the first
  SSH connection.
- Update `docs/deploy.md` and `HANDOVER.md` with the new IP and domain. Both
  currently state there is no production site, which is true until this is
  done and should not be left stale afterwards.
- The ALdocs brochure and meeting invite still print `wellsim.app`. That name
  now resolves nowhere. Anyone handed those documents gets a dead link.

## What does not change

- The repository is public (`EBMEA/WellSim_dev`). Nothing in `data/`, the
  workbooks, the ESP catalogue or ALdocs is in git, and that is what makes
  publishing safe. Deploying does not alter it.
- `data/` holds real client cases from two companies. It is gitignored and
  must be copied to the server out of band, never through the repo.
- There are no password hashes anywhere any more — `users.json` was removed
  from the workstation, every backup and every archive on 9–10 September. A
  fresh server starts with no accounts and no way to register one, which is
  the intended state. Do not "restore" an old `users.json` to fix an empty
  account list.
