# Design

## Direction contract

**THESIS** — The blog is a translucent-grape CRT workstation you sit down at. It refuses the centered-card, icon-and-heading blog shell: the machine, the inset screen, and the directory of entries are the composition.

**OWN-WORLD** — Lavender polycarbonate case, deep violet screen well, ivory-purple keycaps, lilac phosphor, horizontal scanlines, mono channel readouts, wide molded display lettering, and a serif reading column. Every control is a physical key; every divider is a seam or a scan line.

**STORY** — The visitor tunes into the latest posts, scans titles and dates, opens an entry, reads code and diagrams, then follows a tag or an external port. The language and theme keys stay in the bezel, so orientation never leaves the machine.

**FIRST VIEWPORT** — A large machine frame on a violet desk: brand plate and control rail at the top, inset screen below. The screen opens with a status line, a two-column title/intro composition, then the latest post directory at full screen width. The primary action is the post title; the secondary is RSS.

**FORM** — Code-led build (no image-generation round). The ambition is carried by the machine frame, the inset screen, the physical controls, and the typographic contrast between molded display type and Literata prose. Motion is a single CRT warm-up and scan sweep, disabled under reduced motion.

**FINISH** — unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Visual system

### Palette

| Role | Light | Dark |
| --- | --- | --- |
| Desk | `#ddcdee` → `#c8b1df` | `#0b0612` → `#190c26` |
| Case | `#f0e4fb` → `#aa88c9` | `#4b2c67` → `#170c23` |
| Screen | `#f8f2ff` | `#160c23` |
| Screen inset | `#f0e5ff` / `#e8d9fb` | `#1e1130` / `#27163c` |
| Ink | `#281039` | `#f5ebff` |
| Soft ink | `#4a2e5e` | `#d3bde7` |
| Muted | `#6b4f7e` | `#b09ac4` |
| Accent | `#5f1bbd` | `#d2b0ff` |
| Keycap | `#f6edff` | `#3b2554` |
| Code ground | `#f0e5fd` | `#0f0818` |

Body and muted text clear 4.5:1 on the screen in both themes. Case muted text clears 4.5:1 on the case. The only saturated non-purple accent is the copy-confirmation / interactive state, which borrows the accent rather than introducing a second brand color.

### Type

- **Archivo Variable** (`wdth` axis, 720–850 weight, 110–120% width) for the brand, headings, post titles, and tag presets. It reads like molded plastic lettering without becoming a novelty face.
- **Literata Variable** for prose. 17px/1.76 in the reading column, 70ch measure.
- **DejaVu Sans Mono** for channel readouts, dates, labels, keycaps, and code. It has no programming ligatures and avoids the JetBrains Mono look. Mono is reserved for code and machine language.
- Imports are self-hosted through Fontsource; no Google Fonts request at runtime.

### Composition

- The machine is `min(1180px, calc(100% - clamp(18px, 5vw, 64px)))` inside a full-height desk field.
- The bezel holds the brand and a single control rail: Home, Tags, RSS, EN | PT, theme.
- The screen is one large flat surface with a status bar, a main reading region, and generous internal padding. There are no nested cards; post entries are ruled rows.
- Tag presets are large keycap surfaces, not cards with icons. Counts sit at the top right, names at the bottom left.
- Posts use a single 760px reading column inside the screen. The title and metadata are part of the machine readout; the body is the paper inside it.
- Long posts get a native `<details>` contents panel. Its list uses balanced CSS columns, so entries read down each column (1/4, 2/5, 3/6 for six sections) rather than across rows; numbers and link text share one size.
- The footer is the machine base: external ports, copyright, Astro/RSS/website links.

### Chrome details

- Screen: 3px horizontal scanlines under content, a soft edge vignette, a one-shot sweep on load, and a faint phosphor glow on headings in dark mode.
- Case: layered inset/outset shadows, a subtle plastic grain, a thick screen well, and a top-lit gradient. No decorative screws or fake status LEDs remain.
- Controls: keycap bevels, pressed states, a physical theme rocker with exactly centered sun and moon icons, and EN always on the left of PT.
- Browser surfaces: themed selection, caret, scrollbar, focus rings, underlined prose links, and a visible skip link.

### Motion

One authored moment: the screen warms up (brightness/saturation) and a single sweep crosses the glass. Controls press down; rows and arrows respond on hover. All of it collapses to effectively no motion under `prefers-reduced-motion: reduce`. Content is never hidden by animation.

## Responsive rules

- `> 900px`: two-column index intro; three-column tag presets; desktop machine with full bezel.
- `≤ 900px`: index intro stacks; tag presets fall to two columns.
- `≤ 820px`: control rail takes the full bezel width; post rows put date above the title.
- `≤ 620px`: near-edge machine, single-column presets, smaller keycaps, 14px screen padding, single-column TOC.
- `≤ 390px`: tighter key gaps and padding; controls can wrap as `Home Tags RSS` / `EN PT theme` without breaking the language order.
- Verified at 320, 390, 768, 1024, and 1440 with no horizontal overflow.

## Content and assets

- Text and post images are migrated from the author's existing Zola blog. Alt text and captions are preserved. Raster provenance: author-supplied post screenshots/diagrams in `public/images/posts/`.
- Favicon is an authored SVG CRT prompt mark. The orange cap mark in the bezel is the author-supplied `public/images/logo-square.png`.
- Social marks come from Simple Icons; UI marks are authored SVG strokes. Fonts are OFL via Fontsource.
- No generated raster assets are shipped.
