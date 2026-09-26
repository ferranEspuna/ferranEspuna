# Editing the site

All page text lives in Markdown. Use GitHub's file editor in a phone browser: open a file, tap the pencil, edit, and commit to `main`. The existing GitHub Pages workflow builds and publishes the site. No local tools are needed.

- `README.md`: homepage.
- `cv/README.md`: research and CV.
- `recipes/README.md`: recipe introduction.
- `recipes/*/README.md`: recipes and ingredient lists.
- `complex_fractals/README.md`: introduction to the explorers.
- `complex_fractals/*/README.md`: each explorer's description, guide, and settings.

Keep the block between `---` lines at the top. This is page metadata: `title` names the page, `description` appears in the listing, and `permalink` keeps its URL stable. A `nav_order` adds a page to the shared navigation; `nav_title` optionally shortens its label. Use `{{ '/path/' | relative_url }}` for internal links that also work when the site is hosted in a subdirectory.

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

## Local development

Run `bundle install`, then `bundle exec jekyll serve`. Visit `http://localhost:4000`. `bundle exec jekyll build` creates `_site/`. Do not edit generated files there.

The site has a single stylesheet and theme selector. System, light, and dark preferences apply everywhere. The fractal runtime is local JavaScript and WebGL, with no CDN runtime dependency. It renders on interaction rather than continuously while idle. Family scripts provide only the mathematical rule; shared rendering, navigation, orbit controls, and pop-outs live in `complex_fractals/`.

## Browser checks

Install the Python `playwright` package in a virtual environment and run `playwright install chromium`. With the site running locally, run `python tests/browser_smoke.py`. Set `SITE_URL` to test another local address. The checks exercise all six shaders, pointer and keyboard controls, pop-out state, mobile layouts, theme persistence, recipe search, and saved checklists.
