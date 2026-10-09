import { LEVELS, createGame, submitChoice, advance } from './engine.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const presentation = {
  merge: { filename: 'checkout.js', note: 'One conflict. A surprising number of ways to lose behavior.', speech: 'Both branches meant well. That is how it starts.' },
  timer: { filename: 'heartbeat.test.js', note: 'The clock is fake. The infinitely recurring headache is real.', speech: 'I counted twelve beats. I only have two little hands.' },
  retry: { filename: 'release-client.js', note: 'A loop, a limit, and a recursive escape hatch nobody asked for.', speech: 'I made a stop sign. Please consider using it.' },
};
let state = createGame();
let selected = 0;
let hintShown = false;

function announce(text) { $('#announcer').textContent = text; }
function setText(selector, text) { $(selector).textContent = text; }
function valueText(value) { return value === null ? 'rejected' : JSON.stringify(value); }
function focus(selector) { $(selector).focus({ preventScroll: false }); }

function renderProgress() {
  $$('#gate-track li').forEach((item, index) => {
    const solved = index < state.solved.length;
    item.classList.toggle('done', solved);
    if (index === state.levelIndex) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    item.querySelector('.gate-number').textContent = solved ? '✓' : `0${index + 1}`;
    item.querySelector('.gate-state').textContent = solved ? 'OPEN' : index === state.levelIndex ? 'YOU ARE HERE' : 'LOCKED';
    item.setAttribute('aria-label', `Gate ${index + 1}, ${LEVELS[index].gate}, ${solved ? 'open' : index === state.levelIndex ? 'current puzzle' : 'locked'}`);
  });
}

function renderChoices(level) {
  const fragment = document.createDocumentFragment();
  level.choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.className = 'patch-option'; button.dataset.choice = String(index);
    button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', String(selected === index));
    button.tabIndex = selected === index ? 0 : -1;
    const number = document.createElement('span'); number.className = 'option-index'; number.textContent = String(index + 1); number.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span'); copy.className = 'option-copy'; copy.textContent = choice.label;
    const marker = document.createElement('span'); marker.className = 'option-marker'; marker.setAttribute('aria-hidden', 'true');
    button.append(number, copy, marker); fragment.append(button);
  });
  $('#patch-options').replaceChildren(fragment);
}

function renderCode(level) {
  const fragment = document.createDocumentFragment();
  level.code.forEach((line, index) => {
    const row = document.createElement('span'); row.className = 'code-line';
    const number = document.createElement('span'); number.className = 'line-number'; number.textContent = String(index + 1).padStart(2, '0'); number.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.className = /^(<<<<<<<|=======|>>>>>>>)/.test(line) ? 'line-conflict' : line.includes('//') ? 'line-warning' : 'line-code'; text.textContent = line;
    row.append(number, text); fragment.append(row);
  });
  $('#code-lines').replaceChildren(fragment);
}

function renderFeedback() {
  const feedback = state.feedback;
  $('#feedback').classList.toggle('success', feedback.passed);
  setText('#feedback-eyebrow', feedback.passed ? 'PATCH VERIFIED / GATE UNLOCKED' : 'A USEFUL FAILURE / YOUR BUILD IS SAFE');
  setText('#feedback-title', feedback.passed ? 'That did it.' : 'Almost. Look at the evidence.');
  const passed = feedback.checks.filter(check => check.passed).length;
  setText('#checks-count', `${passed} / ${feedback.checks.length} checks pass`);
  const choice = LEVELS[state.levelIndex].choices.find(item => item.id === feedback.choiceId);
  setText('#selected-patch', `Patch tested: ${choice.label}`);
  const fragment = document.createDocumentFragment();
  feedback.checks.forEach(check => {
    const item = document.createElement('li'); item.className = `check ${check.passed ? 'pass' : 'fail'}`;
    const top = document.createElement('div'); top.className = 'check-top';
    const status = document.createElement('span'); status.className = 'check-status'; status.textContent = check.passed ? 'PASS' : 'FAIL';
    const title = document.createElement('span'); title.className = 'check-name'; title.textContent = check.label;
    top.append(status, title);
    const details = document.createElement('div'); details.className = 'check-details';
    for (const [label, value] of [['Observed', check.actual], ['Expected', check.expected]]) {
      const line = document.createElement('span'); line.append(`${label}: `);
      const content = document.createElement('b'); content.textContent = valueText(value); line.append(content); details.append(line);
    }
    item.append(top, details); fragment.append(item);
  });
  $('#checks').replaceChildren(fragment);
  setText('#feedback-message', feedback.message);
  const copy = feedback.passed ? state.levelIndex === LEVELS.length - 1 ? 'Open the final door' : 'Next gate' : 'Try another patch';
  $('#continue-button').replaceChildren(document.createTextNode(copy));
  const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true'); $('#continue-button').append(arrow);
}

function render() {
  const complete = state.phase === 'complete';
  document.body.dataset.phase = state.phase;
  $('.mission-intro').hidden = complete;
  $('#workbench').hidden = state.phase !== 'choice';
  $('#feedback').hidden = state.phase !== 'feedback';
  $('#complete').hidden = !complete;
  renderProgress();
  if (complete) {
    setText('#patch-count', String(state.attempts.length));
    if (!$('#complete .complete-buddy')) {
      const wrapper = document.createElement('div'); wrapper.className = 'complete-buddy buddy-stage'; wrapper.dataset.mood = 'celebrating';
      const art = $('.buddy-art').cloneNode(true);
      art.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      art.removeAttribute('aria-labelledby'); art.setAttribute('aria-label', 'Bot Buddy celebrating outside the pipeline.');
      wrapper.append(art); $('#complete').prepend(wrapper);
    }
    return;
  }
  const level = LEVELS[state.levelIndex];
  const detail = presentation[level.id];
  setText('#gate-eyebrow', `GATE 0${state.levelIndex + 1} / ${level.gate}`);
  setText('#puzzle-title', level.title); setText('#story', level.story); setText('#objective', level.objective);
  setText('#hint-copy', level.hint); $('#hint-copy').hidden = !hintShown;
  $('#hint-button').setAttribute('aria-expanded', String(hintShown));
  $('#buddy-stage').dataset.mood = state.phase === 'feedback' ? state.feedback.passed ? 'celebrating' : 'concerned' : 'thinking';
  setText('#buddy-speech', state.phase === 'feedback' ? state.feedback.passed ? 'A tiny victory. An appropriately tiny celebration.' : 'Useful evidence! We can fix this. I brought snacks.' : detail.speech);
  setText('#buddy-art-title', `Bot Buddy, a small mint robot, ${state.phase === 'feedback' ? state.feedback.passed ? 'celebrating a working patch.' : 'encouraging you to try another patch.' : 'waiting for your patch.'}`);
  $('#buddy-mouth').setAttribute('d', state.phase === 'feedback' && !state.feedback.passed ? 'M150 132q10-5 20 0' : 'M148 130q12 8 24 0');
  if (state.phase === 'choice') { setText('#code-filename', detail.filename); setText('#code-note', detail.note); renderCode(level); renderChoices(level); }
  else renderFeedback();
}

function select(index, moveFocus = false) {
  if (state.phase !== 'choice' || !Number.isInteger(index) || index < 0 || index > 3) return;
  selected = index;
  $$('.patch-option').forEach((button, position) => { button.setAttribute('aria-checked', String(position === selected)); button.tabIndex = position === selected ? 0 : -1; });
  if (moveFocus) focus(`.patch-option[data-choice="${selected}"]`);
}
function testPatch() {
  if (state.phase !== 'choice') return;
  state = submitChoice(state, LEVELS[state.levelIndex].choices[selected].id);
  render();
  announce(`${state.feedback.passed ? 'Patch passed. Gate unlocked.' : 'Patch failed. You can try again.'} ${state.feedback.checks.filter(check => check.passed).length} of ${state.feedback.checks.length} checks pass.`);
  focus('#feedback-title');
}
function continueGame() {
  if (state.phase !== 'feedback') return;
  const oldLevel = state.levelIndex;
  state = advance(state);
  if (state.levelIndex !== oldLevel) { selected = 0; hintShown = false; }
  render();
  if (state.phase === 'complete') { announce(`All three gates open. ${state.attempts.length} patches tried. Bot Buddy escaped.`); focus('#complete-title'); }
  else { announce(`Gate ${state.levelIndex + 1}. ${LEVELS[state.levelIndex].title}`); focus('#puzzle-title'); }
}
function replay() { state = createGame(); selected = 0; hintShown = false; render(); announce('A new rescue. Gate one is ready.'); focus('#puzzle-title'); }
function toggleHint() { if (state.phase === 'complete') return; hintShown = !hintShown; $('#hint-copy').hidden = !hintShown; $('#hint-button').setAttribute('aria-expanded', String(hintShown)); if (hintShown) announce(`Buddy's hint: ${LEVELS[state.levelIndex].hint}`); }
function openDialog(id) { const dialog = $(`#${id}`); if (!dialog.open) dialog.showModal(); }

$('#patch-options').addEventListener('click', event => { const button = event.target.closest('[data-choice]'); if (button) select(Number(button.dataset.choice), true); });
$('#primary-action').addEventListener('click', testPatch);
$('#continue-button').addEventListener('click', continueGame);
$('#replay-button').addEventListener('click', replay);
$('#hint-button').addEventListener('click', toggleHint);
$('#help-button').addEventListener('click', () => openDialog('help-dialog'));
for (const id of ['terminal-button', 'terminal-footer']) $(`#${id}`).addEventListener('click', () => openDialog('terminal-dialog'));
$$('[data-close]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.close}`).close()));
$('#copy-command').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#terminal-command').value); setText('#copy-feedback', 'Copied. Buddy is ready for a change of scenery.'); }
  catch { $('#terminal-command').focus(); $('#terminal-command').select(); setText('#copy-feedback', 'Command selected. Copy it with your usual keyboard shortcut.'); }
});

document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable || $$('dialog').some(dialog => dialog.open)) return;
  const key = event.key.toLowerCase();
  const relevant = ['1', '2', '3', '4', 'enter', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'h', 'r'].includes(key);
  if (event.repeat) { if (relevant) event.preventDefault(); return; }
  if (/^[1-4]$/.test(key) && state.phase === 'choice') { event.preventDefault(); select(Number(key) - 1, true); }
  else if (key.startsWith('arrow') && event.target.closest('#patch-options') && state.phase === 'choice') { event.preventDefault(); select((selected + (key === 'arrowup' || key === 'arrowleft' ? 3 : 1)) % 4, true); }
  else if (key === 'h' && state.phase !== 'complete') { event.preventDefault(); toggleHint(); }
  else if (key === 'r' && state.phase === 'complete') { event.preventDefault(); replay(); }
  else if (key === 'enter' && (event.target.closest('#patch-options') || !event.target.closest('button,a'))) {
    if (state.phase === 'choice') { event.preventDefault(); testPatch(); }
    else if (state.phase === 'feedback') { event.preventDefault(); continueGame(); }
  }
});

render();
