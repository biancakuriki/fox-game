# Fox Game

A small endless runner built with HTML, CSS, and vanilla JavaScript. Guide the fox over incoming obstacles, build up your score, and try to beat your best run.

## Live Demo

Play it here: [biancakuriki.github.io/fox-game](https://biancakuriki.github.io/fox-game/)

## Play Locally

No build step is required.

1. Open `index.html` in your browser.
2. Press `Space` to start jumping.
3. Press `Space` again after a crash to restart.

## Controls

- `Space`: jump
- `Space` on game over: restart

## Features

- Fox runner character with animated sprites
- Random obstacle patterns with cacti and birds
- Difficulty that ramps up as your score increases
- Best score saved in `localStorage`
- Milestone celebration banners during longer runs
- Lightweight setup with no dependencies

## Project Structure

- `index.html`: game shell and HUD
- `style.css`: layout and visual styling
- `script.js`: gameplay loop, physics, obstacles, scoring, and audio
- `assets/`: SVG sprites for the fox and obstacles

## Notes

- A modern browser with Canvas support is recommended.
- If assets do not appear, make sure the `assets/` folder stays next to `index.html`.
- Repository: [github.com/biancakuriki/fox-game](https://github.com/biancakuriki/fox-game)
