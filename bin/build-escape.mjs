#!/usr/bin/env node
import { createGame, LEVELS, evaluateChoice, submitChoice, advance } from '../src/engine.mjs';
import { plainPuzzle, plainFeedback, summary } from '../src/view.mjs';
import { runTerminalGame, runPlainGame } from '../src/terminal.mjs';

const HELP = `BUILD ESCAPE 1.0.0
A tiny terminal escape room with Bot Buddy. Three gates, about two minutes.

Usage: build-escape [--plain | --demo | --help | --version]

  --plain    Line-based play. No colors, cursor controls or raw input.
             Works with screen readers, narrow terminals and piped answers.
  --demo     Show a complete, deterministic winning run without interaction.
  --help     Show this help.
  --version  Print the version.

Terminal keys: arrows or 1-4 choose; Enter tests a patch; H gives a hint.
Q or Escape leaves safely. Ctrl+C restores the terminal before leaving.
NO_COLOR disables colors; TERM=dumb uses plain mode.

The game uses no network, subprocesses, telemetry, disk writes or dependencies.
All code, clocks and service responses are local simulations.
`;

function demo() {
  let state = createGame();
  process.stdout.write('BUILD ESCAPE / DEMO / Bot Buddy [o_o]\nA guided escape. Use an interactive terminal to make your own calls.\n\n');
  while (state.phase !== 'complete') {
    const level = LEVELS[state.levelIndex];
    process.stdout.write(plainPuzzle(state));
    const answer = level.choices.find(choice => evaluateChoice(level.id, choice.id).passed);
    process.stdout.write(`\nBuddy chooses: ${answer.label}\n\n`);
    state = submitChoice(state, answer.id);
    process.stdout.write(`${plainFeedback(state.feedback)}\n`);
    state = advance(state);
  }
  process.stdout.write(plainPuzzle(state));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--plain', '--demo', '--help', '-h', '--version', '-v'].includes(arg))) {
    process.stderr.write('Unknown option. Use build-escape --help.\n'); process.exitCode = 2; return;
  }
  if (args.includes('--help') || args.includes('-h')) { process.stdout.write(HELP); return; }
  if (args.includes('--version') || args.includes('-v')) { process.stdout.write('1.0.0\n'); return; }
  if (args.includes('--demo')) { demo(); return; }
  if (!args.includes('--plain') && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    process.stdout.write(`${HELP}\nNo interactive terminal detected. Try --demo, or pipe answers to --plain.\n`); return;
  }
  const plain = args.includes('--plain') || process.env.TERM === 'dumb' || (process.stdout.columns ?? 80) < 80 || (process.stdout.rows ?? 24) < 24;
  const outcome = plain ? await runPlainGame() : await runTerminalGame({ colors: !Object.hasOwn(process.env, 'NO_COLOR') });
  if (!plain || outcome.quit) process.stdout.write(`\n${summary(outcome.state)}\n${outcome.quit ? 'Buddy will keep your seat warm. Nothing was saved.' : 'Release shipped. Thank you for helping the small robot.'}\n`);
  if (outcome.interrupted) process.exitCode = 130;
}

process.stdout.on('error', error => {
  if (error.code === 'EPIPE') { process.exitCode = 0; return; }
  process.stderr.write('Terminal output disconnected.\n'); process.exitCode = 1;
});
main().catch(error => { process.stderr.write(`Build Escape: ${error.message}\n`); process.exitCode = 1; });
