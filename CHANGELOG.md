# Changelog

All notable changes to Solar Drift are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning.

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
