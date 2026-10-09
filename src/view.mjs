import { LEVELS } from './engine.mjs';

const RGB = { text: '235;239;249', mint: '157;232;194', lilac: '206;186;246', dim: '162;176;199', coral: '255;177;170' };
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;
const visibleLength = text => text.replace(ANSI, '').length;
const format = value => value === null ? 'rejected' : JSON.stringify(value);
export const summary = state => `BUILD ESCAPE: ${state.solved.length}/3 gates open; ${state.attempts.length} patch${state.attempts.length === 1 ? '' : 'es'} tried.`;

export function plainPuzzle(state, hint = false) {
  if (state.phase === 'complete') return `${summary(state)}\nRelease shipped. Bot Buddy has escaped the pipeline.\nNo files, services or real builds were changed.\n`;
  const level = LEVELS[state.levelIndex];
  const lines = [`GATE ${state.levelIndex + 1}/3: ${level.gate} | ${level.title}`, '', level.story, level.objective, '', ...level.code.map(line => `  ${line}`), ''];
  if (hint) lines.push(`Buddy's hint: ${level.hint}`, '');
  level.choices.forEach((choice, index) => lines.push(`${index + 1}. ${choice.label}`));
  return `${lines.join('\n')}\n`;
}

export function plainFeedback(feedback) {
  return `${feedback.checks.map(item => `${item.passed ? 'PASS' : 'FAIL'} ${item.label}\n     observed: ${format(item.actual)}; expected: ${format(item.expected)}`).join('\n')}\n\n${feedback.message}\n`;
}

export function renderScreen(state, { selected = 0, width = 88, height = 30, colors = true, hint = false } = {}) {
  const size = Math.min(110, Math.max(60, width));
  const contentWidth = size - 6;
  const paint = (name, text) => colors ? `\x1b[38;2;${RGB[name]}m${text}\x1b[38;2;${RGB.text}m` : text;
  const lines = [];
  const wrap = (text, max = contentWidth) => {
    const output = []; let line = '';
    for (const word of text.split(' ')) {
      if (line && visibleLength(`${line} ${word}`) > max) { output.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    output.push(line); return output;
  };
  const rule = paint('dim', '─'.repeat(contentWidth));
  lines.push(paint('mint', 'BUILD ESCAPE') + paint('dim', '  /  a tiny release rescue'));
  lines.push(LEVELS.map((level, index) => paint(index < state.solved.length ? 'mint' : index === state.levelIndex ? 'lilac' : 'dim', `${index < state.solved.length ? '✓' : '○'} ${level.gate}`)).join(paint('dim', '   →   ')));
  lines.push(rule);
  if (state.phase === 'complete') {
    lines.push('', paint('mint', '       ╭─────────╮'), paint('mint', '    ╭──┤  ◕   ◕  ├──╮') + '    ALL THREE GATES OPEN.', paint('mint', '    ╰──┤   ╰─╯   ├──╯') + '    One small robot. One shipped build.', paint('mint', '       ╰──┬───┬──╯'), paint('mint', '          ▰   ▰'), '');
    lines.push(paint('lilac', summary(state)), ...wrap('Buddy places a tiny sticker on the release: “probably fine, but actually tested.”'), '', paint('dim', 'You can leave now. The next deploy is somebody else’s problem.'), '', rule, paint('mint', 'ENTER') + ' leave the room    ' + paint('lilac', 'R') + ' replay    ' + paint('dim', 'Q') + ' quit');
  } else {
    const level = LEVELS[state.levelIndex];
    lines.push(paint('lilac', `0${state.levelIndex + 1}  ${level.title}`));
    if (height >= 32) {
      lines.push(paint('mint', '  ╭─────╮') + '   ' + wrap(level.story, contentWidth - 12)[0], paint('mint', '  │ ◕ ◕ │') + '   ' + (wrap(level.story, contentWidth - 12)[1] ?? 'No irreversible mistakes in this room.'), paint('mint', '  ╰─┬─┬─╯'));
    }
    lines.push(...wrap(level.objective).map(line => paint('dim', line)), '');
    if (state.phase === 'feedback') {
      lines.push(paint(state.feedback.passed ? 'mint' : 'coral', state.feedback.passed ? 'PATCH VERIFIED' : 'A USEFUL FAILURE'));
      for (const check of state.feedback.checks) {
        lines.push(paint(check.passed ? 'mint' : 'coral', `${check.passed ? '✓' : '×'} ${check.label}`));
        if (!check.passed || height >= 32) lines.push(paint('dim', `  got ${format(check.actual)} / want ${format(check.expected)}`));
      }
      lines.push('', ...wrap(state.feedback.message), '', rule, paint('mint', 'ENTER') + (state.feedback.passed ? ' open the next gate' : ' try another patch') + '    ' + paint('dim', 'Q') + ' quit');
    } else {
      lines.push(...level.code.map(line => paint('dim', `  ${line}`)), '');
      level.choices.forEach((choice, index) => {
        const prefix = `${index === selected ? '›' : ' '} ${index + 1} `;
        lines.push(paint(index === selected ? 'mint' : 'text', prefix + choice.label));
      });
      if (hint) lines.push('', ...wrap(`Buddy: ${level.hint}`).map(line => paint('lilac', line)));
      lines.push('', rule, paint('mint', '↑↓ / 1–4') + ' choose    ' + paint('mint', 'ENTER') + ' test patch    ' + paint('lilac', 'H') + ' hint    ' + paint('dim', 'Q') + ' quit');
    }
  }
  const bg = colors ? '\x1b[48;2;24;34;55m\x1b[38;2;235;239;249m' : '';
  const reset = colors ? '\x1b[0m' : '';
  return lines.map(line => `${bg}   ${line}${' '.repeat(Math.max(0, contentWidth - visibleLength(line)))}   ${reset}`).join('\n');
}
