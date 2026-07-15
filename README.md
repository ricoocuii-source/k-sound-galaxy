# K Sound Galaxy · Planetfall

This branch is the clean iteration baseline for the Planetfall experience:

- 25 artists rendered as true spherical worlds
- a visible Star Fighter with two wingmen
- free-look, WASD flight and two ship camera rigs
- cubic Bezier transitions for approach, landing and return flights
- orbiting songs with iTunes artwork and 30-second previews

The canonical page is [`proto7.html`](./proto7.html). The root page redirects
to it so `http://127.0.0.1:<port>/` and `/proto7.html` open the same experience.

## Run locally

Prerequisite: Node.js.

```bash
npm ci
PORT=3020 npm run dev
```

Then open `http://127.0.0.1:3020/proto7.html`.

## Validate

```bash
npm run lint
npm run build
```

The Vite build explicitly includes both `index.html` and `proto7.html`.

## Asset notes

- The bundled Star Fighter is licensed CC BY-NC 4.0 and is not cleared for
  commercial use. Keep `models/starfighter/license.txt` with the model.
- Planet textures are credited to Solar System Scope under CC BY 4.0 in the
  experience attribution.
- The HUD uses augmented-ui under MIT.
- The Milky Way sky, lens flares, artwork and audio previews load from external
  services; the local ship and spherical worlds still render if those requests
  are unavailable.
