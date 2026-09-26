# Editing the site

All page text lives in Markdown. Use GitHub's file editor in a phone browser: open a file, tap the pencil, edit, and commit to `main`. The existing GitHub Pages workflow builds and publishes the site. No local tools are needed.

- `README.md`: homepage.
- `cv/README.md`: research and CV.
- `recipes/README.md`: recipe introduction.
- `recipes/*/README.md`: recipes and ingredient lists.
- `complex_fractals/README.md`: introduction to the explorers.
- `complex_fractals/*/README.md`: each explorer's description, guide, and settings.

Keep the block between `---` lines at the top. This is page metadata: `title` names the page, `description` appears in the listing, and `permalink` keeps its URL stable. Back links are derived from the page URL: nested pages link to their parent page and to Home. Use `{{ '/path/' | relative_url }}` for internal links that also work when the site is hosted in a subdirectory.

## Add a recipe

Create `recipes/my-recipe/README.md` using the GitHub editor:

```markdown
---
layout: recipe
category: recipe
title: My recipe
description: A short description, including useful quantities or timing.
lang: en
permalink: /recipes/my-recipe/
---

# My recipe

## Ingredients

- [ ] First ingredient — quantity
- [ ] Second ingredient — quantity

## Method

1. First step.
2. Second step.
```

The recipe listing updates automatically. Checklists save locally by ingredient text, so reordering ingredients does not move their checked states. Renaming an ingredient resets that ingredient's state.

To add another ordinary page, use `layout: page`, a title, a permalink, and Markdown content. No Ruby registry or HTML file is needed. Existing URLs and old fractal redirects are preserved.

## Section layout

Add `columns: true` to a page's Markdown front matter to enable balanced newspaper-style columns:

```yaml
---
title: My page
columns: true
---
```

The layout fits as many readable columns as the screen allows (about 26rem minimum width each). Content runs down the first column, then down the next: A B C on the left, D E F on the right. Column heights are balanced by the browser; whole sections may differ in height. Narrow screens use one column.

Set `columns: false`, or leave the setting out, to keep the entire page in a single readable column even on a wide screen. This setting applies to ordinary pages and individual fractal pages. Existing sectioned pages opt in explicitly, so you can change each independently.

Use `##` headings to divide content into sections. Each section, including its `###` subsections, stays together where possible. Text before the first section stays above the columns. Without JavaScript, Markdown remains readable in one column.

Fractal plots and guide sections share the same column flow. Each plot stays in one piece, with shared controls above the columns and exports below them. Add another `##` heading to an explorer README to add another section.

## Local development

Run `bundle install`, then `bundle exec jekyll serve`. Visit `http://localhost:4000`. `bundle exec jekyll build` creates `_site/`. Do not edit generated files there.

The site has a single stylesheet and follows the system light/dark theme everywhere, including when that preference changes while a page is open. The fractal runtime is local JavaScript and WebGL, with no CDN runtime dependency. It renders on interaction rather than continuously while idle. Family scripts provide only the mathematical rule; shared rendering, navigation, orbit controls, and pop-outs live in `complex_fractals/`.

## Browser checks

Install the Python `playwright` package in a virtual environment and run `playwright install chromium`. With the site running locally, run `python tests/browser_smoke.py`. Set `SITE_URL` to test another local address. The checks exercise all six shaders, pointer and keyboard controls, pop-out state, mobile layouts, system themes, recipe search, and saved checklists.

## Fractal exports

Open **Export image or video** under the plots. Choose a plane, resolution, and shape, then save a PNG or record a video. PNGs support longest edges of 1920, 3840, or 7680 pixels, subject to the device's canvas/GPU limits. Videos support 1920 and 3840 pixels. These are new renders at the selected size, not enlarged screenshots.

**Slow zoom** records a 4× zoom toward the current center without changing the interactive view. **Record live controls** follows your changes to the selected plane. Both omit every marker and orbit overlay. Because only the export canvas is captured, the mouse, page controls, and theme never appear in the file.

Recording happens in real time, targeting 30 fps. Actual smoothness depends on the device, resolution, and iteration count. The browser chooses a supported WebM or MP4 encoder. Stop saves the partial recording; cancel discards it. Hiding the tab stops and saves the partial video to avoid a stalled recording. A download link remains available if the automatic download is blocked on mobile. Export settings are separate from the live explorer, and temporary graphics and media resources are released after each export.

Implementation: `complex_fractals/export.js`, `_includes/fractal-export.html`, and the `u_hide_overlays` uniform in each shader. The exporter uses [canvas captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) and [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder). Run `python tests/export_smoke.py` for PNG dimensions, overlay removal, recorded-video playback, cancellation, and unsupported-browser checks.
