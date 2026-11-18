import catalogue from './puzzles.mjs';
import { cells, dailyPuzzle, dayLabel, digits, levels, osloDay } from './puzzle.mjs';

const byId = id => document.getElementById(id);
const board = byId('board');
const keypad = byId('keypad');
const levelButtons = [...document.querySelectorAll('[data-level]')];
const dialog = byId('confirm-dialog');
const status = byId('feedback');
const progress = byId('progress');
const progressText = byId('progress-text');
const notesButton = byId('notes');
const undoButton = byId('undo');
const eraseButton = byId('erase');
const checkButton = byId('check');
const hintButton = byId('hint');
const clearErrorsButton = byId('clear-errors');
const revealButton = byId('reveal');
const resetButton = byId('reset');
const dateLabel = byId('game-date');
const newDay = byId('new-day');
const storageNote = byId('storage-note');

const storagePrefix = 'bygdebladet:sudoku:daily:v1:';
const savedThisSession = new Map();
const historyLimit = 120;
const errors = new Set();
const embedded = window.parent !== window;
const embedProtocol = 'bygdebladet-sudoku';
const numberKeys = [];
const cellButtons = [];
let game;
let pendingAction;

function readStorage(key) {
  try { return localStorage.getItem(key); }
  catch { storageNote.hidden = false; return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, value); }
  catch { storageNote.hidden = false; }
}

function stateKey(day, level) {
  return storagePrefix + day + ':' + level;
}

function save() {
  const { day, level, signature, values, notes, notesMode, selected, history, revealed } = game;
  const key = stateKey(day, level);
  const payload = JSON.stringify({ signature, values, notes, notesMode, selected, history, revealed });
  savedThisSession.set(key, payload);
  writeStorage(key, payload);
}

function isCell(index) {
  return Number.isInteger(index) && index >= 0 && index < cells.length;
}

function isValue(value) {
  return Number.isInteger(value) && value >= 0 && value <= 9;
}

function isNotesMask(mask) {
  return Number.isInteger(mask) && mask >= 0 && mask <= 0x3fe && (mask & 1) === 0;
}

function restore(key, puzzle, signature) {
  const raw = savedThisSession.get(key) ?? readStorage(key);
  if (!raw) return null;
  let data;
  try { data = JSON.parse(raw); }
  catch { return null; }
  if (
    data?.signature !== signature || !Array.isArray(data.values) || !Array.isArray(data.notes) ||
    data.values.length !== 81 || data.notes.length !== 81 || !data.values.every(isValue) ||
    !data.notes.every(isNotesMask) || !puzzle.every((given, i) => !given || data.values[i] === given)
  ) return null;

  const history = Array.isArray(data.history)
    ? data.history.slice(-historyLimit).filter(move =>
        Array.isArray(move) && move.length > 0 && move.length <= 81 &&
        move.every(entry => {
          if (!Array.isArray(entry) || entry.length !== 3) return false;
          const [i, value, notes] = entry;
          return isCell(i) && !puzzle[i] && isValue(value) && isNotesMask(notes);
        }))
    : [];
  return {
    values: data.values,
    notes: data.notes,
    notesMode: data.notesMode === true,
    selected: isCell(data.selected) ? data.selected : puzzle.indexOf(0),
    history,
    revealed: data.revealed === true
  };
}

function loadGame(day, level, { reset = false } = {}) {
  const { puzzle, solution } = dailyPuzzle(day, level, catalogue);
  const signature = puzzle.join('');
  const previous = reset ? null : restore(stateKey(day, level), puzzle, signature);
  const start = {
    values: [...puzzle],
    notes: Array(81).fill(0),
    selected: puzzle.indexOf(0),
    notesMode: false,
    history: [],
    revealed: false
  };
  game = { day, level, signature, puzzle, solution, ...(previous ?? start) };
  errors.clear();
  dateLabel.dateTime = day;
  dateLabel.textContent = dayLabel(day);
  writeStorage(storagePrefix + 'level', level);
  render();
  announce(reset ? 'Starta på nytt.' : '');
  updateDay();
}

function isSolved() {
  return game.values.every((value, i) => value === game.solution[i]);
}

function numberList(mask) {
  return digits.filter(n => mask & (1 << n));
}

function renderBoard(locked) {
  const selected = cells[game.selected];
  const selectedValue = game.values[game.selected];
  cellButtons.forEach(({ button, wrapper, valueLabel, noteLabels }, i) => {
    const { row, col, box } = cells[i];
    const value = game.values[i];
    const given = game.puzzle[i] !== 0;
    const current = i === game.selected;
    const wrong = errors.has(i);

    button.tabIndex = current ? 0 : -1;
    button.classList.toggle('given', given);
    button.classList.toggle('selected', current);
    button.classList.toggle('peer', !current && (row === selected.row || col === selected.col || box === selected.box));
    button.classList.toggle('same', !current && value !== 0 && value === selectedValue);
    button.classList.toggle('error', wrong);
    wrapper.setAttribute('aria-selected', String(current));
    wrapper.setAttribute('aria-readonly', String(locked || given));
    valueLabel.textContent = value || '';
    for (const digit of digits) {
      noteLabels[digit - 1].textContent = !value && (game.notes[i] & (1 << digit)) ? digit : '';
    }
    const notes = numberList(game.notes[i]);
    const description = value ? (given ? 'gitt tal ' + value : String(value))
      : notes.length ? 'notat ' + notes.join(', ') : 'tomt';
    button.setAttribute('aria-label', 'Rad ' + (row + 1) + ', kolonne ' + (col + 1) + ', ' + description + (wrong ? ', feil' : ''));
  });
}

function render() {
  const finished = isSolved();
  const locked = game.revealed || finished;
  const filled = game.values.filter((value, i) => value && !game.puzzle[i]).length;
  const total = game.puzzle.filter(value => value === 0).length;
  progress.max = total;
  progress.value = filled;
  progressText.textContent = game.revealed ? 'Fasit vist' : finished ? 'Løyst' : filled + ' av ' + total + ' felt';
  board.classList.toggle('solved', finished && !game.revealed);

  for (const btn of levelButtons) btn.setAttribute('aria-pressed', String(btn.dataset.level === game.level));
  for (const btn of numberKeys) btn.disabled = locked || Boolean(game.puzzle[game.selected]);
  notesButton.setAttribute('aria-pressed', String(game.notesMode));
  notesButton.disabled = locked;
  undoButton.disabled = game.history.length === 0;
  eraseButton.disabled = locked || Boolean(game.puzzle[game.selected]) ||
    !(game.values[game.selected] || game.notes[game.selected]);
  hintButton.disabled = locked;
  revealButton.disabled = locked;
  clearErrorsButton.disabled = locked;
  checkButton.disabled = game.revealed;
  renderBoard(locked);
}

function announce(message) {
  status.textContent = message;
}

function applyChanges(changes) {
  for (const [index, value, notes] of changes) {
    game.values[index] = value;
    game.notes[index] = notes;
  }
}

function commitMove(changes, message = '') {
  game.history.push(changes.map(([i]) => [i, game.values[i], game.notes[i]]));
  if (game.history.length > historyLimit) game.history.shift();
  applyChanges(changes);
  errors.clear();
  save();
  render();
  announce(isSolved() ? 'Gratulerer! Du løyste brettet.' : message);
}

function selectCell(index, focus = false) {
  if (game.selected !== index) {
    game.selected = index;
    render();
  }
  if (focus) cellButtons[index].button.focus({ preventScroll: true });
}

function enter(digit) {
  const i = game.selected;
  if (game.puzzle[i] || game.revealed || isSolved()) return;

  const oldValue = game.values[i];
  const oldNotes = game.notes[i];
  if (digit && game.notesMode) {
    if (!oldValue) commitMove([[i, 0, oldNotes ^ (1 << digit)]]);
  } else if (oldValue !== digit || (!digit && oldNotes)) {
    commitMove([[i, digit, 0]]);
  }
}

function wrongCells() {
  return game.values.flatMap((value, i) => value && value !== game.solution[i] ? [i] : []);
}

function toggleNotes() {
  if (notesButton.disabled) return;
  game.notesMode = !game.notesMode;
  save();
  render();
}

function undo() {
  const move = game.history.pop();
  if (!move) return;
  game.selected = move[0][0];
  applyChanges(move);
  errors.clear();
  save();
  render();
  if (board.contains(document.activeElement)) selectCell(game.selected, true);
  announce('Siste trekk er angra.');
}

function giveHint() {
  let i = game.selected;
  if (game.values[i] === game.solution[i]) {
    i = game.values.findIndex((value, index) => value !== game.solution[index]);
  }
  if (i === -1) return;
  game.selected = i;
  const { row, col } = cells[i];
  commitMove([[i, game.solution[i], 0]], 'Hint lagt inn i rad ' + (row + 1) + ', kolonne ' + (col + 1) + '.');
}

function buildBoard() {
  const fragment = document.createDocumentFragment();
  cells.forEach(({ col }, i) => {
    if (col === 0) {
      const row = document.createElement('div');
      row.className = 'board-row';
      row.setAttribute('role', 'row');
      fragment.append(row);
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'grid-cell';
    wrapper.setAttribute('role', 'gridcell');
    const button = document.createElement('button');
    button.className = 'cell';
    button.type = 'button';
    button.dataset.cell = i;
    const valueLabel = document.createElement('span');
    valueLabel.className = 'cell-value';
    valueLabel.setAttribute('aria-hidden', 'true');
    const noteGrid = document.createElement('span');
    noteGrid.className = 'cell-notes';
    noteGrid.setAttribute('aria-hidden', 'true');
    const noteLabels = digits.map(() => document.createElement('span'));
    noteGrid.append(...noteLabels);
    button.append(valueLabel, noteGrid);
    wrapper.append(button);
    fragment.lastElementChild.append(wrapper);
    cellButtons.push({ button, wrapper, valueLabel, noteLabels });
  });
  board.append(fragment);
}

function buildKeypad() {
  for (const digit of digits) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = digit;
    button.setAttribute('aria-label', 'Tal ' + digit);
    button.addEventListener('click', () => enter(digit));
    numberKeys.push(button);
  }
  keypad.append(...numberKeys);
}

const arrowMovement = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]
};

function handleBoardKey(event) {
  const { key } = event;
  if (event.ctrlKey || event.metaKey) {
    if (key.toLowerCase() === 'z' && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      undo();
    }
    return;
  }
  if (event.altKey) return;
  if (Object.hasOwn(arrowMovement, key)) {
    event.preventDefault();
    const [r, c] = arrowMovement[key];
    const { row, col } = cells[game.selected];
    const clamp = n => Math.min(8, Math.max(0, n));
    selectCell(clamp(row + r) * 9 + clamp(col + c), true);
  } else if (/^[1-9]$/.test(key)) {
    event.preventDefault();
    enter(Number(key));
  } else if (['Backspace', 'Delete', '0'].includes(key)) {
    event.preventDefault();
    enter(0);
  } else if (key.toLowerCase() === 'n') {
    event.preventDefault();
    toggleNotes();
  }
}

function notifyHost(type, detail = {}) {
  if (embedded) window.parent.postMessage({ widget: embedProtocol, type, ...detail }, '*');
}

function reportHeight() {
  notifyHost('height', { height: Math.ceil(document.body.getBoundingClientRect().height) });
}

const confirmations = {
  reset: {
    title: 'Start på nytt',
    description: 'Framdrifta på dette brettet blir nullstilt.',
    action: () => { loadGame(game.day, game.level, { reset: true }); save(); }
  },
  reveal: {
    title: 'Vis fasit',
    description: 'Heile løysinga blir fylt inn. Du kan starte på nytt for å spele brettet igjen.',
    action: () => {
      game.values = [...game.solution];
      game.notes.fill(0);
      game.history = [];
      game.revealed = true;
      game.notesMode = false;
      errors.clear();
      save();
      render();
      announce('Fasiten er vist.');
    }
  }
};

function showConfirmation(action) {
  pendingAction = confirmations[action];
  byId('confirm-title').textContent = pendingAction.title;
  byId('confirm-text').textContent = pendingAction.description;
  byId('confirm').textContent = pendingAction.title;
  dialog.showModal();
  notifyHost('open');
}

function updateDay() {
  newDay.hidden = osloDay() === game.day;
}

buildBoard();
buildKeypad();
for (const eventName of ['click', 'focusin']) {
  board.addEventListener(eventName, event => {
    const cell = event.target.closest('[data-cell]');
    if (cell) selectCell(Number(cell.dataset.cell));
  });
}
board.addEventListener('keydown', handleBoardKey);
for (const button of levelButtons) {
  button.addEventListener('click', () => {
    const { level } = button.dataset;
    if (level !== game.level) loadGame(game.day, level);
  });
}
notesButton.addEventListener('click', toggleNotes);
undoButton.addEventListener('click', undo);
eraseButton.addEventListener('click', () => enter(0));
hintButton.addEventListener('click', giveHint);
checkButton.addEventListener('click', () => {
  errors.clear();
  for (const index of wrongCells()) errors.add(index);
  render();
  announce(errors.size === 0 ? (isSolved() ? 'Alt er rett.' : 'Ingen feil så langt.')
    : errors.size === 1 ? 'Eitt felt er merkt med feil.' : errors.size + ' felt er merkte med feil.');
});
clearErrorsButton.addEventListener('click', () => {
  const wrong = wrongCells();
  if (wrong.length) commitMove(wrong.map(i => [i, 0, 0]), 'Feil er tømde.');
  else announce('Ingen feil å tømme.');
});
resetButton.addEventListener('click', () => showConfirmation('reset'));
revealButton.addEventListener('click', () => showConfirmation('reveal'));
byId('cancel').addEventListener('click', () => dialog.close());
byId('confirm').addEventListener('click', () => {
  const action = pendingAction;
  dialog.close();
  action?.action();
  selectCell(game.selected, true);
});
dialog.addEventListener('close', () => {
  pendingAction = undefined;
  notifyHost('close');
});
byId('today').addEventListener('click', () => loadGame(osloDay(), game.level));

const lastLevel = readStorage(storagePrefix + 'level');
loadGame(osloDay(), Object.hasOwn(levels, lastLevel) ? lastLevel : 'medium');
byId('game').hidden = false;
setInterval(updateDay, 30000);
window.addEventListener('focus', updateDay);
document.addEventListener('visibilitychange', updateDay);

if (embedded) {
  new ResizeObserver(reportHeight).observe(document.body);
  window.addEventListener('message', event => {
    if (event.source === window.parent && event.data?.widget === embedProtocol &&
        event.data.type === 'measure') requestAnimationFrame(reportHeight);
  });
}
