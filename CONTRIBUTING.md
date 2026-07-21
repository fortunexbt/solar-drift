# Contributing to Solar Drift

Thanks for helping tune the machine. Small, focused changes are easiest to review and safest for a real-time canvas game.

## Setup

1. Install Node.js 20.19 or newer.
2. Run `npm ci`.
3. Start the game with `npm run dev`.
4. Before opening a pull request, run `npm run check`.

## Change contract

- Preserve keyboard, pointer, and touch paths when changing controls.
- Keep interactive UI on native controls and maintain visible focus states, useful labels, and status announcements.
- Test pure rules and serialization deterministically; avoid timing-dependent assertions.
- Do not add analytics, remote persistence, accounts, or multiplayer behavior without documenting the new product boundary.
- Do not add recordings, fonts, images, or other third-party assets without a source, author, and redistribution license. Procedural or original assets are preferred.
- Keep generated output (`dist/`, coverage, caches, and dependencies) out of commits.

## Pull requests

Describe the player-visible effect, note any change to saved data, and include a screenshot or short capture for visual work. If the change affects performance, test at both the highest and lowest render-quality tiers.

By contributing, you agree that your work is licensed under the project's MIT License.
