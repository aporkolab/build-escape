import { emitKeypressEvents, createInterface } from 'node:readline';
import { createGame, LEVELS, submitChoice, advance } from './engine.mjs';
import { renderScreen, plainPuzzle, plainFeedback } from './view.mjs';

/** TTY adapter. All owned listeners, cursor state and raw mode are restored on every exit. */
export function runTerminalGame({ input = process.stdin, output = process.stdout, signals = process, colors = true } = {}) {
  let state = createGame();
  let selected = 0;
  let hint = false;
  let closed = false;
  let opened = false;
  const wasRaw = Boolean(input.isRaw);
  const listeners = [];
  const listen = (emitter, event, listener) => { emitter.on(event, listener); listeners.push([emitter, event, listener]); };
  const cleanup = () => {
    if (closed) return;
    closed = true;
    for (const [emitter, event, listener] of listeners) emitter.removeListener(event, listener);
    try { input.setRawMode(wasRaw); } catch { /* The stream may already be closed. */ }
    input.pause();
    if (opened) { try { output.write('\x1b[0m\x1b[?25h\x1b[?1049l'); } catch { /* A disconnected output cannot be restored. */ } }
  };
  return new Promise((resolve, reject) => {
    const finish = (quit = true, interrupted = false) => { cleanup(); resolve({ state, quit, interrupted }); };
    const fail = error => { cleanup(); reject(error); };
    const draw = () => {
      try {
        const width = output.columns ?? 80;
        const screen = width < 80 || (output.rows ?? 24) < 24
          ? 'Please widen the terminal to 80 x 24, or press Q to leave.\nUse --plain for any terminal size.'
          : renderScreen(state, { selected, hint, colors, width, height: output.rows ?? 24 });
        output.write(`\x1b[H\x1b[2J${screen}`);
      } catch (error) { fail(error); }
    };
    const keypress = (_text, key = {}) => {
      try {
        if (key.name === 'q' || key.name === 'escape' || (key.ctrl && key.name === 'c')) { finish(true, Boolean(key.ctrl && key.name === 'c')); return; }
        if (state.phase === 'complete') {
          if (key.name === 'return' || key.name === 'enter') finish(false);
          else if (key.name === 'r') { state = createGame(); selected = 0; hint = false; draw(); }
          return;
        }
        if (state.phase === 'feedback') {
          if (key.name === 'return' || key.name === 'enter') { state = advance(state); selected = 0; hint = false; draw(); }
          return;
        }
        if (key.name === 'up' || key.name === 'left') selected = (selected + 3) % 4;
        else if (key.name === 'down' || key.name === 'right') selected = (selected + 1) % 4;
        else if (/^[1-4]$/.test(key.name ?? '')) selected = Number(key.name) - 1;
        else if (key.name === 'h') hint = !hint;
        else if (key.name === 'return' || key.name === 'enter') state = submitChoice(state, LEVELS[state.levelIndex].choices[selected].id);
        else return;
        draw();
      } catch (error) { fail(error); }
    };
    try {
      if (typeof input.setRawMode !== 'function') throw new Error('Raw terminal mode is unavailable. Run with --plain.');
      emitKeypressEvents(input);
      listen(input, 'keypress', keypress);
      listen(input, 'end', () => finish());
      listen(input, 'close', () => finish());
      listen(input, 'error', fail);
      listen(output, 'error', fail);
      listen(signals, 'SIGINT', () => finish(true, true));
      listen(signals, 'SIGTERM', () => finish(true, true));
      listen(signals, 'SIGWINCH', draw);
      listen(signals, 'exit', cleanup);
      input.setRawMode(true);
      input.resume();
      opened = true;
      output.write('\x1b[?1049h\x1b[?25l');
      draw();
    } catch (error) { fail(error); }
  });
}

/** Line-oriented mode: no colors, cursor commands or raw input; also accepts piped answers. */
export async function runPlainGame({ input = process.stdin, output = process.stdout } = {}) {
  let state = createGame();
  const reader = createInterface({ input, output, terminal: false });
  const prompt = () => {
    if (state.phase === 'choice') output.write(`${plainPuzzle(state)}\nChoose 1-4 and Enter; H for hint; Q to quit.\n> `);
    else if (state.phase === 'feedback') output.write(`${plainFeedback(state.feedback)}\nPress Enter to continue, or Q to quit.\n> `);
  };
  output.write('BUILD ESCAPE / Bot Buddy [o_o]\nThree build gates. Every mistaken patch is recoverable.\n\n');
  prompt();
  try {
    for await (const line of reader) {
      const answer = line.trim().toLowerCase();
      if (answer === 'q') return { state, quit: true };
      if (state.phase === 'feedback') {
        state = advance(state);
        if (state.phase === 'complete') { output.write(`\n${plainPuzzle(state)}`); return { state, quit: false }; }
      } else if (/^[1-4]$/.test(answer)) state = submitChoice(state, LEVELS[state.levelIndex].choices[Number(answer) - 1].id);
      else if (answer === 'h') { output.write(`\nBuddy: ${LEVELS[state.levelIndex].hint}\n> `); continue; }
      else { output.write('Choose 1, 2, 3 or 4. H gives a hint; Q leaves safely.\n> '); continue; }
      output.write('\n'); prompt();
    }
    return { state, quit: true };
  } finally { reader.close(); }
}
