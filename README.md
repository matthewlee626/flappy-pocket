# Flappy Pocket

A mobile-friendly Flappy Bird browser recreation built with React, TypeScript, Canvas, and Vinext. Tap, click, or press Space / Arrow Up / W to flap. Press P or Escape to pause. Best scores are stored on this device. Switching tabs automatically pauses the game.

## Run locally

Requires Node 22.13 or newer.

```sh
npm install
npm run dev
```

Open the localhost URL printed by the server. `npm run build` creates the production build. `npx tsc --noEmit` checks types.

## Online asset references

The visual direction references original gameplay screenshots found through an online image search:
- https://thegamesdb.net/game.php?id=123335

Sprites are from https://github.com/samuelcust/flappy-bird-assets (bird animation, pipes, daytime skyline, and ground). The repository declares MIT licensing; its notice is preserved at `public/assets/LICENSE`. Flappy Bird is the original game by Dong Nguyen / .GEARS. This is an unofficial recreation.

## Implementation

120 Hz fixed-step simulation with capped elapsed time, randomized pipe gaps, circle-approximation bird hitbox, scoring only after clearing a pipe, local high scores, optional synthesized audio, keyboard/touch support, pause/resume, and resize-independent 288 × 512 game coordinates. Art is served locally; gameplay does not depend on third-party image URLs.

Optional WebMCP state and pause/resume tools are feature-detected. Live WebMCP registration was not tested because a supported browser validation context was unavailable.
