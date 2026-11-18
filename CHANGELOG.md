# Changelog

All notable changes to Solar Drift are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning.

## [Unreleased]

### Added

- A title-screen lesson flight: the real simulation, steered by a seeded pilot, loops and catches suns under a three-step caption.
- Capture sparks and shock rings, a short shake on hits, and a score pulse on each catch.
- A run map on the result screen, a "new personal best" call-out, and a share button.
- Open Graph image, touch icon and an updated web manifest.
- The arena walls double as meters. The top wall is the clock, with the seconds riding its end, and the bottom wall fills with surge.
- A faint preview of the loop the ship is about to close, with the suns inside it brightened.
- Captured suns flare and send light streaming to the score, the closed loop flashes gold, and hits tint the screen edges red.

### Changed

- Sound now starts off and stays off until the player turns it on.
- Raised low-contrast small text to meet WCAG AA.
- Redesigned the interface around the playfield. The title, HUD, pause and result screens drop the monospace capital labels for sentence-case text, the score reads as a number with its unit, and the result screen leads with the light collected followed by one line of run details.
- Pausing dims the flight instead of hiding it, and the first-flight hints step aside after the second capture.

### Removed

- Leftover Snake-era favicon, social preview and gameplay image.

## [1.0.0] - 2026-07-21

### Added

- A first-run flight manual, concise product-truth messaging, and exposed daily/local-score panels.
- Responsive coarse-pointer controls and compact small-screen HUD behavior.
- Semantic buttons, keyboard focus treatment, canvas instructions, live announcements, and zoom-safe viewport behavior.
- Deterministic tests for vector, meta progression, leaderboard, daily seed, formatting, and run-code utilities.
- GitHub Actions workflows for pull-request verification and GitHub Pages deployment.
- Project metadata, original favicon/social-preview artwork, contribution guidance, and MIT licensing.

### Changed

- Renamed the launch package to Solar Drift and updated its current Vite, TypeScript, and test toolchain.
- Replaced unverifiable, malformed audio blobs with a fully procedural WebAudio score.
- Synchronized input state across pause, resume, restart, game-over, and quit transitions.

### Removed

- Four corrupted MP3 files with no usable metadata or substantiated provenance.
