# fig website

The [fig.inc](https://www.fig.inc) website — a Ghost theme that serves both the
marketing landing (`/`) and the blog (`/blog/`) from a single Ghost install.

Built on Ghost's [Source](https://github.com/TryGhost/Source) theme, with the
fig landing folded in and styling unified across the whole site.

## Layout

- **Home (`/`)** — the landing, rendered in a sticky left-sidebar shell
  (`home.hbs` + `default.hbs`). Persistent sidebar nav site-wide.
- **Blog (`/blog/`)** — a Thinking Machines-style index (date · title · author
  rows) with a serif-italic page header.
- **Posts (`/blog/{slug}/`)** — centered reading column; related posts render
  as an "Articles" tile strip.

Shared palette, fonts (Geist + Computer Modern Serif italic), logo, footer, and
the pixel-cursor effect (`assets/js/pixel.js`).

## Theme settings baked into `package.json`

- `show_images_in_feed` → `false` (clean text list)

## Local development

The theme is symlinked into a local Ghost install for live editing:

```
ghost-local/content/themes/fig-blog -> this repo
```

Edits to `.hbs` / CSS appear on refresh (Ghost dev mode). Validate with
[gscan](https://github.com/TryGhost/gscan): `npx gscan .`

## Deploy

1. Zip the repo contents and upload via **Settings → Design → Change theme**.
2. Upload `routes.yaml` via **Settings → Labs → Routes** (creates `/blog/`;
   not part of the theme zip).
3. Upload `redirects.yaml` via **Settings → Labs → Redirects** (301s old
   `/{slug}/` post URLs to `/blog/{slug}/`).
4. Set navigation (**Settings → Navigation**): Home → `/`, Blog → `/blog/`.

CI/CD via GitHub Actions (`TryGhost/action-deploy-theme`) is planned to
automate step 1 on push.
