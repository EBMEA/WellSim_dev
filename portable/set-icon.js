// Give the portable exe the WellSim icon instead of node.exe's.
//
// build.ps1 copies node.exe and injects the app into it, so until 30 Sep 2026
// every WellSim.exe wore the Node.js hexagon in Explorer, on the taskbar and
// in the Save dialog. This replaces the exe's icon group with
// portable/wellsim.ico -- the same drawing as the website's icons
// (scripts/make-icons.mjs).
//
// ORDER MATTERS. It runs AFTER postject injects the SEA blob, and before
// signing. postject (LIEF) moves .rsrc to the END of the file, so replacing the
// icon here only rewrites the tail and nothing else can move. Run the other way
// round -- icon first, on the raw node.exe -- resedit has to shift .reloc to
// make room, and postject's parser then reports "Relocation corrupted" on the
// file it is handed. The table measured intact both ways (526 consistent
// blocks), but a build that prints an error is not a build to ship.
// The injected exe still carries node.exe's now-stale certificate pointer;
// resedit is told to drop it, and our own signature is applied last.
// Usage: node portable/set-icon.js <exe> <ico>
import fs from 'node:fs';
import * as ResEdit from 'resedit';

const [exePath, icoPath] = process.argv.slice(2);
if (!exePath || !icoPath) throw new Error('usage: node portable/set-icon.js <exe> <ico>');

const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(exe);
const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));

// replace every existing icon group in place (node.exe ships one), keeping its
// id and language so the shell's default-icon lookup still lands on it
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
if (groups.length === 0) throw new Error('no icon group in ' + exePath);
for (const g of groups) {
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries, g.id, g.lang, ico.icons.map((i) => i.data)
  );
}
res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log(`icon set: ${ico.icons.length} frames from ${icoPath} into ${groups.length} icon group(s)`);
