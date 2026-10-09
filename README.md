# Build Escape

**Three broken build gates. One small robot. About two minutes.**

Bot Buddy is trapped inside your release pipeline. Help the mint-colored robot reconcile a merge conflict, stop a runaway test, and teach a retry loop when to give up. Every patch runs against a small executable model. Failed checks show what happened, and you can always try again.

A dependency-free browser and terminal game by [Ádám Porkoláb](https://github.com/aporkolab).

## Play in your browser

**[Rescue Bot Buddy →](https://aporkolab.github.io/build-escape/)**

Three playable gates, visible test results, hints and replay. Click a patch or use the keyboard. The browser demo uses the exact same pure puzzle engine as the terminal version. No installation, sign-in or AI service is required.

## Play in your terminal

Requires **Node.js 20 or newer**, npm, and Git for the GitHub shortcut:

```sh
npx --yes --package=github:aporkolab/build-escape#v1.0.0 build-escape
```

This command installs the tagged GitHub source into npm's temporary package cache. The package is distributed through GitHub; it is **not published to the npm registry**.

For an extracted [GitHub release](https://github.com/aporkolab/build-escape/releases/tag/v1.0.0), run the included entry point directly:

```sh
tar -xzf aporkolab-build-escape-1.0.0.tgz
node package/bin/build-escape.mjs
```

Or clone the repository and run `npm start`. No dependency installation or build step is needed to play.

## The room

| Gate | Your job | Evidence |
| --- | --- | --- |
| **Source** | Preserve a quantity guard and a new discount during a merge | Executed checkout examples, including a rounding edge case |
| **Test** | Observe three heartbeats without leaving a recurring timer | A bounded virtual-clock trace |
| **Release** | Add finite, selective retry with exponential backoff | Simulated 400, 429 and 503 response sequences |

The screen uses an original terminal-drawn Bot Buddy, mint and lilac accents, and a dark navy panel. Incorrect patches carry no score penalty, time limit, or permanent failure.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys or **1–4** | Select a patch |
| **Enter** | Test the selection, then continue |
| **H** | Show or hide Buddy's hint |
| **Q**, **Escape**, or **Ctrl+C** | Leave and restore the terminal |
| **R** on the final screen | Play again |

An 80 × 24 terminal fits the compact interface. Narrower terminals automatically use line-based play.

```sh
build-escape --plain    # Screen-reader-friendly, line-based controls
build-escape --demo     # Deterministic guided solution; no input needed
build-escape --help
build-escape --version
```

When running directly from the checkout, substitute `node bin/build-escape.mjs` for `build-escape`. To pass an option through the GitHub launch command, append it after `build-escape`.

`NO_COLOR` disables colors. `TERM=dumb` and `--plain` disable cursor positioning and raw input as well. Plain mode accepts piped answers, so it works without a TTY. The default non-TTY invocation prints help instead of waiting indefinitely.

## What runs

The game uses only Node's built-in modules. It makes **no network requests**, launches **no subprocesses**, stores **no scores or files**, reads **no personal files**, and sends **no telemetry**. There are no install, prepare, or postinstall scripts. All timer and HTTP behavior is simulated; no player-entered code is evaluated.

npm or Git may access the network and their own cache to download the package before the game starts. The game itself runs offline.

## Develop

```sh
npm ci --ignore-scripts
npm test
npm run demo
npm run build:demo
npm pack --dry-run --ignore-scripts
```

The engine consists of pure deterministic models and immutable game-state transitions. Tests cover puzzle invariants, recovery from every wrong patch, terminal cleanup after normal exit, interruption, EOF and stream errors, accessible input, and the non-TTY CLI. CI runs the suite on Node 20, 22 and 24.

For the browser demo, `npm run build:demo` copies `src/engine.mjs` into `docs/engine.mjs`. Serve `docs/` with any local static server. The generated engine copy is ignored by Git. Successful main-branch CI publishes the static demo through GitHub Pages; visiting or playing the game never starts Actions or an AI model. Browser assets are served from the same site, with no analytics or external runtime services.

Publishing a GitHub release with a matching `v1.0.0` tag triggers the release workflow: run the tests, package only the runtime and documentation, calculate SHA-256 checksums, upload a workflow artifact, and attach the tarball and `SHA256SUMS` to that release. Re-running the workflow replaces those two assets. It does not publish to npm.

## License

[MIT](LICENSE). Make something small and strange with it.
