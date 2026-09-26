# Editing the site

All page text lives in Markdown. Use GitHub's file editor in a phone browser: open a file, tap the pencil, edit, and commit to `main`. The existing GitHub Pages workflow builds and publishes the site. No local tools are needed.

- `README.md`: homepage.
- `cv/README.md`: research and CV.
- `recipes/README.md`: recipe introduction.
- `recipes/*/README.md`: recipes and ingredient lists.
- `complex_fractals/README.md`: introduction to the explorers.
- `complex_fractals/*/README.md`: each explorer's description, guide, and settings.

Keep the `<!-- page … -->` comment at the top. GitHub hides this comment instead of displaying a metadata table. This is page metadata: `title` names the page, `description` appears in the listing, and `permalink` keeps its URL stable. Back links are derived from the page URL: nested pages link to their parent page and to Home. Use normal Markdown links such as `[Fractals](https://ferran.info/complex_fractals/)`. These open the published site from both GitHub and the website; use relative repository links such as `[Editing guide](docs/editing.md)` when you want to link to a source file on GitHub.

## Add a recipe

Create `recipes/my-recipe/README.md` using the GitHub editor:

```markdown
<!-- page
layout: recipe
category: recipe
title: My recipe
description: A short description, including useful quantities or timing.
lang: en
permalink: /recipes/my-recipe/
-->

# My recipe

## Ingredients

- [ ] First ingredient — quantity
- [ ] Second ingredient — quantity

## Method

1. First step.
2. Second step.
```

The recipe listing updates automatically. Checklists save locally by ingredient text, so reordering ingredients does not move their checked states. Renaming an ingredient resets that ingredient's state.

To add another ordinary page, use `layout: page`, a title, a permalink, and Markdown content. The Jekyll generator discovers README files automatically; no registry or HTML file is needed. The existing Pages workflow supports this generator. A README with no settings comment uses its first `#` heading as the title and its folder as the URL. Existing URLs and old fractal redirects are preserved.

## Section layout

Add `columns: true` to a page's hidden settings comment to enable balanced newspaper-style columns:

```markdown
<!-- page
title: My page
columns: true
-->
```

The layout fits as many readable columns as the screen allows (about 26rem minimum width each). Content runs down the first column, then down the next: A B C on the left, D E F on the right. Column breaks are chosen from the measured section heights to minimize differences between column heights while keeping sections in order. The layout recalculates when the screen or content size changes; a single long section can still make its column taller. Narrow screens use one column. If fewer sections exist than available column slots, only the needed columns are shown and the group is centered.

Set `columns: false`, or leave the setting out, to keep the entire page in a single readable column even on a wide screen. This setting applies to ordinary pages and individual fractal pages. Existing sectioned pages opt in explicitly, so you can change each independently.

Use `##` headings to divide content into sections. Each section, including its `###` subsections, stays together where possible. Text before the first section stays above the columns. Without JavaScript, Markdown remains readable in one column.

Fractal plots and guide sections share the same column flow. Each plot stays in one piece, with shared controls above the columns and exports below them. Add another `##` heading to an explorer README to add another section.

## Local development

Run `bundle install`, then `bundle exec jekyll serve`. Visit `http://localhost:4000`. `bundle exec jekyll build` creates `_site/`. Do not edit generated files there.

The site has a single stylesheet and follows the system light/dark theme everywhere, including when that preference changes while a page is open. The fractal runtime is local JavaScript and WebGL, with no CDN runtime dependency. It renders on interaction rather than continuously while idle. Family scripts provide only the mathematical rule; shared rendering, navigation, orbit controls, and pop-outs live in `complex_fractals/`.

## Build checks

Run `python3 tests/markdown_pages_test.py` to check hidden settings, plain README defaults, excluded files, custom URLs, and useful errors for invalid settings or duplicate URLs.

## Browser checks

Install the Python `playwright` package in a virtual environment and run `playwright install chromium`. With the site running locally, run `python tests/browser_smoke.py`. Set `SITE_URL` to test another local address. The checks exercise all six shaders, pointer and keyboard controls, pop-out state, mobile layouts, system themes, recipe search, and saved checklists.

Run `python tests/fractal_interaction_test.py` for right-click mode changes, wheel zoom, real touch double-tap/pinch sequences, and fullscreen exits. Point placement is independent of keyboard focus. On mobile it lasts for one double-tap-and-drag gesture; a second finger cancels placement and restores the point before zooming. The fullscreen entry button hides while fullscreen is active. Where native fullscreen is unavailable, a same-page history entry makes the browser’s Back action close the expanded plot.

Run `python tests/column_balance_test.py` to check measured-height balancing against every possible ordered partition, including the CV’s Education placement, resizing, and content changes.

## Fractal exports

Open **Export image or video** under the plots. Choose a plane, resolution, and shape, then save a PNG or record a video. PNGs support longest edges of 1920, 3840, or 7680 pixels, subject to the device's canvas/GPU limits. Videos support 1920 and 3840 pixels. These are new renders at the selected size, not enlarged screenshots.

**Slow zoom** records a 4× zoom toward the current center without changing the interactive view. **Record live controls** follows your changes to the selected plane. Both omit every marker and orbit overlay. Because only the export canvas is captured, the mouse, page controls, and theme never appear in the file.

Recording happens in real time, targeting 30 fps. Actual smoothness depends on the device, resolution, and iteration count. The browser chooses a supported WebM or MP4 encoder. Stop saves the partial recording; cancel discards it. Hiding the tab stops and saves the partial video to avoid a stalled recording. A download link remains available if the automatic download is blocked on mobile. Export settings are separate from the live explorer, and temporary graphics and media resources are released after each export.

Implementation: `complex_fractals/export.js`, `_includes/fractal-export.html`, and the `u_hide_overlays` uniform in each shader. The exporter uses [canvas captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) and [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder). Run `python tests/export_smoke.py` for PNG dimensions, overlay removal, recorded-video playback, cancellation, and unsupported-browser checks.
