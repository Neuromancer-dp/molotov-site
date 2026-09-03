# Molotov Studios — Site Build Spec

Personal site for Anirudh Mallick ("Molotov"). Dark, dossier-style, GLaDOS-adjacent deadpan
tone. Reference aesthetic: ryoku.dev (bone-on-black, technical spec-sheet layout, live
timestamp, halftone imagery, vertical rotated marginal text, barcode/edition footer).

## Pages
- Home
- About
- Projects
- Contact

Single consistent visual system across all four — same header nav, same footer, same
dossier-row component reused for different content (specs on Home, facts on About,
project details on Projects, contact channels on Contact).

## Design Tokens

```css
--bg: #0A0A09;          /* near-black base */
--surface: #141412;     /* cards / panels */
--surface-hover: #1B1B18;
--text: #E8E3D3;         /* bone / paper */
--text-muted: #8B8578;   /* labels, captions, secondary text */
--border: #2A2822;       /* hairline dividers */
--accent: #C9A876;       /* rare warm highlight — one CTA, one hover state, links */
```

## Typography
- Display: an editorial serif with real character (e.g. Fraunces, or similar — something
  with personality, not a generic serif) — used for page headlines only, large, tight
  tracking.
- Label / mono: JetBrains Mono — used for nav, eyebrows, spec-sheet labels, stats, tags,
  timestamps, footer text. Small size, wide letter-spacing, uppercase where used as a label.
- Body: a clean humanist sans (Inter or similar) — used for paragraph copy only.

## Layout Motifs
- Full-bleed dark canvas throughout.
- Vertical rotated text in page margins (small caps, mono, tracked out) — e.g. a repeating
  label like "MOLOTOV · SUBJECT FILE" running up the left edge on desktop, hidden on mobile.
- Dossier-row component: a repeatable label/value row with a thin baseline rule, used
  differently per page (see content below). This is the site's core structural device —
  build it once, reuse everywhere.
- Barcode/edition footer flourish site-wide: small mono text bottom-left/right, e.g.
  "SPECIMEN NO. 001" and a fake generated barcode graphic (CSS gradient stripes is fine,
  doesn't need to be a real scannable barcode).
- Live local time display in the header or hero, updating client-side (JS setInterval),
  mono font, small.

## Hero Signature Visual
A processed image (provided separately as `hero-duotone.png`) — a duotone (near-black to
bone) treatment of a custom collage artwork. Used as the Home page hero background,
full-bleed, with a gradient fade to solid `--bg` in the lower third so headline text stays
legible. Do not add additional filters/overlays on top of the provided image — it's
pre-processed.

## Content

### HOME

Eyebrow: `// SUBJECT DOSSIER — CLASSIFICATION: UNRESOLVED`

Headline (display serif, large): `Molotov Studios`

Subhead: `An ongoing experiment in competence. Results pending.`

Live status line (mono, small, below subhead):
`LOCAL TIME — [live clock, HH:MM:SS]  ·  STATUS — Conscious, allegedly productive`

Dossier rows:
```
SUBJECT           Anirudh Mallick
DESIGNATION       Molotov
LOCATION          Hyderabad Enrichment Center
STACK             Python · Claude Code · unreasonable amounts of tea
COOPERATION       Mandatory, mostly voluntary
```

Stat block (4 columns, big mono numbers over small labels):
```
04              11                  1               0
PROJECTS        PROJECTS            CAKE            REGRETS
SHIPPED         ABANDONED           PROMISED        (VISIBLE)
                (FOR SCIENCE)
```

Section intro paragraph (body sans, below the fold):
"This facility exists to document what happens when a person is given tools, time, and
insufficient supervision. So far: mixed results."

Footer flourish: `SPECIMEN NO. 001  ·  TEST CHAMBER 001  ·  ENRICHMENT DIV.`

CTA button (uses --accent sparingly): links to Projects, label: `View test results`

---

### ABOUT

Eyebrow: `// EVALUATION REPORT — SUBJECT: MOLOTOV`

Headline: `A brief history of test results`

Body copy (2-3 paragraphs, humanist sans, comfortable line-height, max ~60ch width):

"The subject was first observed exhibiting technical curiosity at an early age, a trait
that has since proven difficult to suppress. Repeated exposure to code, design tools, and
unsupervised free time has resulted in a small but growing body of work, most of which
functions as intended.

Subject demonstrates above-average persistence, a concerning tolerance for late-night
debugging, and a tendency to start more experiments than can reasonably be finished. This
is being monitored.

Current areas of interest include software, systems that build other systems, and whatever
breaks next. No cake has been received to date, despite full cooperation."

Facts panel (dossier rows):
```
BASED IN            Hyderabad, India
CURRENTLY           Figuring it out
BEHAVIORAL NOTE     Responds well to hard problems, poorly to boredom
THREAT LEVEL        Minimal, probably
```

---

### PROJECTS

Eyebrow: `// TEST LOG — RESULTS ARCHIVE`

Headline: `Completed and ongoing experiments`

Repeatable project card (build as a component, populate with 3-4 placeholder entries for
now — real content to be swapped in later):

```
TEST 00[X]
[Project Name]
RESULT: [one-line outcome, e.g. "Unexpectedly functional"]
[one-line real description of what it does]
[STACK TAGS — mono pills, e.g. Python · SQLite · GTK4]
→ View test subject   (links out to repo/live link)
```

Use placeholder content for now:
- TEST 001 — Trakor — RESULT: Unexpectedly functional — A native desktop milestone
  tracker built to manage things that refuse to track themselves. — Python · GTK4 · SQLite
- TEST 002 — Scratchboard — RESULT: Stable, mostly — A local-first AI workspace, because
  sending everything to the cloud felt like a design flaw. — Node.js · Ollama · SQLite
- TEST 003 — [placeholder] — RESULT: Ongoing — [placeholder description] — [stack]

---

### CONTACT

Eyebrow: `// COMMUNICATION PROTOCOL`

Headline: `Get in touch`

Body: "The cake is not a valid contact method. Use one of the channels below instead.
Response times vary based on subject's current cooperation levels."

Contact rows (dossier style, each value is a live link where applicable):
```
EMAIL        [email — placeholder]
GITHUB       github.com/Neuromancer-dp
LINKEDIN     [linkedin url — placeholder]
STATUS       Currently accepting new experiments
```

## Technical Notes
- Fully responsive, mobile-first breakpoints. Vertical marginal text hides below ~900px.
- Respect `prefers-reduced-motion` — disable the live clock's visual tick animation (if
  any) and any scroll-reveal effects for users who request reduced motion; the clock value
  itself can still update.
- Visible keyboard focus states on all interactive elements (links, nav, buttons).
- Clean semantic HTML, real heading hierarchy (one h1 per page).
- No frameworks required unless Claude Code prefers React/Vite for maintainability — plain
  HTML/CSS/vanilla JS is also perfectly fine given the scope.
