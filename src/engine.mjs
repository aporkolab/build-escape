/** Pure puzzle models. No I/O, real timers, evaluated source text or randomness. */
export const LEVELS = Object.freeze([
  {
    id: 'merge', gate: 'SOURCE', title: 'Two branches. One checkout.',
    story: 'A merge conflict has locked the source gate. Bot Buddy is holding both ends of the cable.',
    objective: 'Keep the quantity guard AND the discount. Round only the final total.',
    code: [
      '<<<<<<< main',
      'if (!Number.isInteger(qty) || qty < 1) return null;',
      'return price * qty;',
      '=======',
      'return round(price * qty * (1 - discount));',
      '>>>>>>> add-discounts',
    ],
    hint: 'Try zero items, a discount, and a price smaller than one cent. Each branch alone loses a requirement.',
    choices: [
      { id: 'ours', label: 'Keep main: the guard is already there.' },
      { id: 'theirs', label: 'Keep add-discounts: the feature must ship.' },
      { id: 'compose', label: 'Combine both; round the final total once.' },
      { id: 'round-first', label: 'Combine both; round the unit price first.' },
    ],
    success: 'The cable clicks into place. One function, both promises kept.',
    failure: 'That patch drops a promise. The gate stays safe; try another patch.',
  },
  {
    id: 'timer', gate: 'TEST', title: 'The test that never clocks out.',
    story: 'The test gate is stuck on a heartbeat interval. Buddy has counted twelve beats and looks concerned.',
    objective: 'Observe exactly three heartbeats, then leave zero scheduled timers.',
    code: [
      'const clock = new FakeClock();',
      'const id = clock.setInterval(heartbeat, 1000);',
      'clock.runAllTimers(); // an interval schedules itself',
      'expect(beats).toBe(3);',
      '// teardown must leave the clock empty',
    ],
    hint: 'Recurring timers never exhaust themselves. Advance a finite amount of virtual time, then cancel the interval.',
    choices: [
      { id: 'more-time', label: 'Raise the test timeout; drain every timer.' },
      { id: 'advance-clear', label: 'Advance 3000 ms, then clear the interval.' },
      { id: 'clear-first', label: 'Clear the interval, then advance 3000 ms.' },
      { id: 'one-pass', label: 'Run one pending timer; skip teardown.' },
    ],
    success: 'Three clean beats. No ghost timers. Buddy stops tapping the wall.',
    failure: 'The clock report disagrees. Nothing is running for real; adjust the patch.',
  },
  {
    id: 'retry', gate: 'RELEASE', title: 'Please do not retry forever.',
    story: 'The release gate keeps calling a service that says no. Buddy has drawn a very small stop sign.',
    objective: 'At most 3 attempts. Retry 429/5xx only. Wait 200, then 400 ms.',
    code: [
      'for (let attempt = 1; attempt <= 3; attempt++) {',
      '  if (send().ok) return SUCCESS;',
      '  sleep(200);',
      '}',
      'return retry(); // the limit resets. oh no.',
    ],
    hint: 'Count calls, classify the failure, and stop after the last attempt. No sleep is needed after success or final failure.',
    choices: [
      { id: 'recursive', label: 'Keep retrying. Eventually the server must agree.' },
      { id: 'all-errors', label: 'Cap at 3; retry every error with backoff.' },
      { id: 'flat-delay', label: 'Cap at 3; retry 429/5xx, always wait 200 ms.' },
      { id: 'bounded', label: 'Cap at 3; retry 429/5xx, wait 200 then 400 ms.' },
    ],
    success: 'The stop sign works. The release gate opens. Buddy would like a snack.',
    failure: 'The service trace found a leak in the policy. You can fix it here.',
  },
]);

const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function quoteTotal(policy, price, qty, discount) {
  if (!['ours', 'theirs', 'compose', 'round-first'].includes(policy)) throw new RangeError('Unknown merge policy.');
  if (policy !== 'theirs' && (!Number.isInteger(qty) || qty < 1)) return null;
  if (policy === 'ours') return price * qty;
  if (policy === 'round-first') return roundMoney(roundMoney(price) * qty * (1 - discount));
  return roundMoney(price * qty * (1 - discount));
}

/** A bounded model of a recurring fake timer. "run all" is diagnosed, never executed forever. */
export function simulateTimer(policy) {
  if (!['more-time', 'advance-clear', 'clear-first', 'one-pass'].includes(policy)) throw new RangeError('Unknown timer policy.');
  let now = 0;
  let beats = 0;
  let scheduled = policy === 'clear-first' ? null : 1000;
  const horizon = policy === 'more-time' ? Infinity : policy === 'one-pass' ? 1000 : 3000;
  const safetyLimit = 12;
  while (scheduled !== null && scheduled <= horizon && beats < safetyLimit) {
    now = scheduled;
    beats += 1;
    scheduled = now + 1000;
  }
  if (policy === 'advance-clear') scheduled = null;
  return { beats, pending: scheduled === null ? 0 : 1, bounded: beats < safetyLimit, now };
}

/** HTTP status simulation: no requests, sleeps or promises are used. */
export function simulateRetry(policy, responses) {
  if (!['recursive', 'all-errors', 'flat-delay', 'bounded'].includes(policy)) throw new RangeError('Unknown retry policy.');
  if (!Array.isArray(responses) || !responses.length || responses.some(code => !Number.isInteger(code) || code < 100 || code > 599)) throw new TypeError('Provide HTTP status fixtures.');
  const attempts = [];
  const waits = [];
  const limit = policy === 'recursive' ? 8 : 3;
  for (let index = 0; index < limit; index += 1) {
    const status = responses[Math.min(index, responses.length - 1)];
    attempts.push(status);
    if (status >= 200 && status < 300) return { attempts, waits, success: true, stopped: true };
    const retryable = policy === 'all-errors' || policy === 'recursive' || status === 429 || status >= 500;
    if (!retryable) return { attempts, waits, success: false, stopped: true };
    if (index + 1 < limit) waits.push(policy === 'flat-delay' || policy === 'recursive' ? 200 : Math.min(1000, 200 * 2 ** index));
  }
  return { attempts, waits, success: false, stopped: policy !== 'recursive' };
}

function check(label, actual, expected) {
  return { label, passed: JSON.stringify(actual) === JSON.stringify(expected), actual, expected };
}

export function evaluateChoice(levelId, choiceId) {
  const level = LEVELS.find(item => item.id === levelId);
  if (!level || !level.choices.some(choice => choice.id === choiceId)) throw new RangeError('Unknown puzzle or patch.');
  let checks;
  if (levelId === 'merge') {
    checks = [
      check('20% off two $10 items', quoteTotal(choiceId, 10, 2, 0.2), 16),
      check('Zero items are rejected', quoteTotal(choiceId, 10, 0, 0.2), null),
      check('Fractional quantity is rejected', quoteTotal(choiceId, 10, 1.5, 0), null),
      check('Round total: $0.004 x 3', quoteTotal(choiceId, 0.004, 3, 0), 0.01),
    ];
  } else if (levelId === 'timer') {
    const clock = simulateTimer(choiceId);
    checks = [check('Exactly three heartbeats', clock.beats, 3), check('No timer survives teardown', clock.pending, 0), check('The virtual clock stops', clock.bounded, true)];
  } else {
    const recovery = simulateRetry(choiceId, [503, 503, 200]);
    const badRequest = simulateRetry(choiceId, [400, 200]);
    const outage = simulateRetry(choiceId, [503]);
    const limited = simulateRetry(choiceId, [429, 200]);
    checks = [
      check('503,503,200: calls + backoff', [recovery.attempts.length, recovery.waits, recovery.success], [3, [200, 400], true]),
      check('400: stop immediately', [badRequest.attempts.length, badRequest.waits, badRequest.success], [1, [], false]),
      check('Persistent 503: stop after 3', [outage.attempts.length, outage.waits, outage.stopped], [3, [200, 400], true]),
      check('429,200: recover once', [limited.attempts.length, limited.waits, limited.success], [2, [200], true]),
    ];
  }
  const passed = checks.every(item => item.passed);
  return { levelId, choiceId, passed, checks, message: passed ? level.success : level.failure };
}

export function createGame() {
  return { phase: 'choice', levelIndex: 0, solved: [], attempts: [], feedback: null };
}

/** Reducers return new state and never alter previous attempts or puzzle data. */
export function submitChoice(state, choiceId) {
  if (state.phase !== 'choice') return state;
  const level = LEVELS[state.levelIndex];
  const feedback = evaluateChoice(level.id, choiceId);
  return { ...state, phase: 'feedback', feedback, attempts: [...state.attempts, { levelId: level.id, choiceId, passed: feedback.passed }] };
}

export function advance(state) {
  if (state.phase !== 'feedback') return state;
  if (!state.feedback.passed) return { ...state, phase: 'choice', feedback: null };
  const solved = [...state.solved, LEVELS[state.levelIndex].id];
  const levelIndex = state.levelIndex + 1;
  return { ...state, solved, levelIndex, phase: levelIndex === LEVELS.length ? 'complete' : 'choice', feedback: null };
}
