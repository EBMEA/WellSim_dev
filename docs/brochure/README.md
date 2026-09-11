# The WellSim brochure

`WellSim-Brochure.html` is the **source**. `WellSim-Brochure.pdf` is what you
hand someone — one A4 page, regenerated from the HTML, not edited by hand.

## Why this folder exists

The brochure used to be a PDF in gitignored `ALdocs/` with **no source at
all** — a one-off Chrome "print to PDF" whose text was hex glyph IDs in
subset fonts. Two things followed from that, and both actually happened:

- **It could not be edited.** When `wellsim.app` was retired the brochure went
  on printing a domain that resolved nowhere, because changing one word meant
  reconstructing the whole document.
- **Nothing could check it.** It claimed a test count 43 short of the real
  suite for about a week. `tests/docs.test.js` exists precisely to catch that,
  but it cannot read a PDF, and `ALdocs/` is not in git.

Source and output are both tracked here now, and the HTML is in the `DOCS`
list in `tests/docs.test.js`, so `npm test` fails if the brochure's numbers
drift from the suite.

## Regenerate

```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="D:\TheSimplestNode\docs\brochure\WellSim-Brochure.pdf" \
  "file:///D:/TheSimplestNode/docs/brochure/WellSim-Brochure.html"
```

**Edge, not Chrome** — Chrome is not installed on this workstation, though the
original brochure was made with it. Any Chromium will do; the `--print-to-pdf`
flag is the same. Expect exactly **one page at 210×297 mm**; if you get two,
the content has outgrown the page and the layout needs tightening rather than
the page count accepting it.

After regenerating, copy it to `ALdocs/WellSim-Brochure.pdf` so the
client-facing bundle matches:

```bash
cp docs/brochure/WellSim-Brochure.pdf ALdocs/WellSim-Brochure.pdf
```

## Two things not to do

- **Do not reflow the three `.stat` blocks onto single lines.** `docs.test.js`
  strips tags and looks for `<n> ... tests`. With the number and its label on
  one source line that collapses to `345unit tests` — no whitespace — and the
  claim becomes invisible to the guard again. The comment above them says so.
- **Do not edit the PDF directly.** It is output. Change the HTML and
  re-render, or the next person inherits the same dead end.

## What is in `ALdocs/`

`ALdocs/WellSim-Brochure-2026-09-04-superseded.pdf` is the original, kept as
the record of what was sent before 11 September 2026. It names the retired
`wellsim.app` and the old test count; both are wrong now and that is the point
of keeping it. It is also inside `aldocs.tar.gz` in the dated backups.
