# Kurt's Isle — a playable portfolio

A portfolio that is also a tiny 3D pixel island. Walk around, visit the cottage, arcade, crystals and campsite, and fill the in-game journal. Built with [Three.js](https://threejs.org/) — every model, texture and sound is generated in the browser.

![status](https://img.shields.io/badge/build-none_needed-38b764) ![three.js](https://img.shields.io/badge/Three.js-r160-41a6f6) ![license](https://img.shields.io/badge/assets-procedural-ffcd75)

## Features

- **Explorable voxel island** — a low-resolution render (640×360) upscaled with nearest-neighbour filtering for crisp pixels.
- **Procedural pixel art** — terrain, path, plaza, flowers, arcade screens, signs and the character portrait are drawn on `<canvas>` at runtime.
- **Animated world** — vertex-waved water, swaying trees, spinning crystals, campfire flicker, chimney smoke, fireflies, drifting labels, walking dust.
- **Portfolio sections as landmarks** — About (cottage), Projects (arcade), Skills (crystals), Contact (campsite).
- **Quest journal** — visit all four landmarks to complete the journal; find the golden duck for a secret entry.
- **Chiptune soundtrack + SFX** — synthesized with WebAudio; no audio files. `M` mutes.
- **Keyboard, mouse and touch** — WASD/arrows, `E` to interact, plus an on-screen joystick on phones.
- **Accessible-ish UI** — focus styles, `aria` labels, reduced-motion support, keyboard navigation for dialogs.
- **No build step, no framework, no dependencies to install** — Three.js and the fonts are vendored in the repo.

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Move |
| `Shift` | Run |
| `E` / `Space` / `Enter` | Interact, advance/close dialogs |
| `Esc` | Close a window |
| `M` | Toggle sound |
| `H` | Open the isle guide |
| `←` / `→` | Browse projects inside the arcade |

On touch devices: drag the joystick to move, tap the **E** button (or the prompt) to interact.

## Run locally

The site uses ES modules, so it needs to be served over HTTP (opening `index.html` from disk will not work).

**Windows (no dependencies):**

```powershell
.\serve.ps1
```

Then open <http://localhost:5173>.

Use a different port with `.\serve.ps1 -Port 8080` if 5173 is busy.

**Any other machine:** use any static server, for example:

```bash
python -m http.server 5173
# or
npx serve .
```

## Make it yours

Almost all copy lives in **`src/content.js`**:

- `about.paragraphs` — your bio.
- `projects` — title, status, blurb, tech tags and link. Two of the three entries are placeholders; replace them.
- `skills` — names, notes and levels (1–5).
- `email`, `github`, `location`, `school` — contact details.
- `secret` — the golden-duck easter egg text.
- `credits` — anything you want to credit.

Other easy tweaks:

- Colours: the UI palette is in `styles.css` (`:root` custom properties); the world palette is `COLORS` in `src/world.js`.
- Landmark positions: `ZONES` in `src/world.js`.
- Discord/Instagram/etc. links: add them as buttons in `openContact()` in `src/ui.js`.
- Avatar: the pixel portrait is defined as ASCII art in `avatarDataURL()` in `src/textures.js`.

## Deploy to GitHub Pages

**Live site:** <https://enzoacidal09.github.io/My-Personal-Website/>

The repository is already set up for GitHub Pages via Actions:

1. Push to `main`.
2. The workflow in `.github/workflows/deploy.yml` publishes the static site automatically.
3. Pages is set to **Source: GitHub Actions**; the workflow also attempts to enable it if it is ever turned off.

The site is plain HTML/CSS/JS, so any static host works too (Netlify, Cloudflare Pages, Vercel, Neocities…).

## Project structure

```
.
├── index.html                 # title screen, HUD and overlays
├── styles.css                 # pixel UI, responsive layout, CRT overlay
├── serve.ps1                  # dependency-free local web server (Windows)
├── src/
│   ├── main.js                # renderer, camera, input, game loop
│   ├── world.js               # island, buildings, props, particles, shaders
│   ├── player.js              # voxel character, movement, collision, animation
│   ├── ui.js                  # dialogs, typewriter, journal, toasts, confetti
│   ├── audio.js               # procedural chiptune + sound effects
│   ├── textures.js            # canvas textures, labels, avatar, arcade screens
│   └── content.js             # ← your portfolio content lives here
├── assets/
│   ├── favicon.svg
│   └── fonts/                 # Press Start 2P + VT323 (OFL)
├── vendor/
│   ├── three.module.js        # Three.js r160 (MIT)
│   └── THREE-LICENSE.txt
└── .github/workflows/deploy.yml
```

## Notes on assets & licences

- **Three.js** r160 is vendored in `vendor/` (MIT licence included).
- **Press Start 2P** and **VT323** fonts are vendored in `assets/fonts/` under the SIL Open Font License (licence texts included).
- **Palette** inspired by “Sweetie 16” by GrafxKid (CC0).
- Everything else — terrain, models, textures, sound, avatar — is generated procedurally in this repo. No external art assets are loaded at runtime, so the site works offline after the first load.

## Known limitations

- The 3D scene targets older integrated GPUs; on very old phones, shadows and fireflies might chug. Lower `sun.shadow.mapSize` in `src/main.js` or reduce particles in `src/world.js` if needed.
- The site is single-page; no routing. Deep links to projects are not available.
- Journal progress is per-session and resets on reload.

---

Made by [Kurt Lawrence V. Ladica](https://github.com/EnzoAcidal09) · Palawan State University.
