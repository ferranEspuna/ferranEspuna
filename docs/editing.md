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

**Record new video** saves a motion take, then renders it. **Slow zoom** creates a 4× zoom toward the selected view's center. **Record live controls** captures changes to both planes, the parameter or root, iterations, and colors. Videos omit every marker and orbit overlay. The mouse, page controls, and theme never appear in the file.

Choose **24, 25, 30, 50, or 60 fps**. Every output frame is rendered at its exact timeline position and encoded before moving on to the next batch. A slow device takes longer to finish without shortening the video or skipping frames. WebM video export requires a browser with WebCodecs and a supported VP9 or VP8 encoder, over HTTPS or localhost. PNG export and motion capture/preview remain available without WebCodecs. A download link remains available if automatic download is blocked.

**Smoothing** filters movement over time, including proportional zoom, pan, and parameters. **Smooth loop for all motion** eases the recorded motion through the first 80% of the duration and returns every value to the start in the final 20%, with zero velocity and acceleration at the join. It changes the timing to make room for this return; it does not duplicate the last frame. **Preview saved motion** shows the result in both explorers and restores the previous view afterward. **Re-render saved video** applies the current smoothing and loop settings to the original tracks and exports at the chosen size, shape, plane, and frame rate. Effects are recalculated from the recorded samples, so repeated renders do not accumulate smoothing.

To replace part of a take, check any combination of **Pan**, **Zoom**, and **Parameters**, then click **Re-record selected** and use the explorer controls. Unchecked tracks play from the previous take with their existing effects; checked tracks receive the current smoothing and loop settings. Pan and zoom each include both planes. Parameters include the complex point/root, iterations, and colors. Replacements keep the saved duration. Stopping early holds the last replacement values for the remaining time, preserving all untouched tracks.

**Stop and save motion** ends a new live take early and renders the partial take. **Cancel** during capture discards the new movement and preserves the previous saved take. Hiding the tab also cancels live capture or preview to avoid recording a stalled interval. Canceling an offline render keeps the captured motion available for retry. Motion stays in memory in the current tab until reload; it is not uploaded or stored permanently. Temporary graphics and encoder resources are released after each export.

Implementation: `complex_fractals/export.js` orchestrates capture and export, `motion.js` interpolates and processes tracks, `video.js` uses [WebCodecs](https://www.w3.org/TR/webcodecs/) and writes a [WebM container](https://www.webmproject.org/docs/container/), and `_includes/fractal-export.html` provides the shared controls. The `u_hide_overlays` shader uniform removes overlays. Run `python tests/fractal_video_test.py` with Playwright and `ffprobe` available for frame counts at every frame rate, playback and seeking, slow rendering, smoothing and loop seams, all seven track combinations, cancellation, partial takes, and unsupported-browser checks.
