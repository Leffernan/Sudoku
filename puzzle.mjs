export const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const levels = { easy: 'Lett', medium: 'Middels', hard: 'Vanskeleg' };
export const cells = Array.from({ length: 81 }, (_, index) => {
  const row = Math.floor(index / 9);
  const col = index % 9;
  return { row, col, box: 3 * Math.floor(row / 3) + Math.floor(col / 3) };
});

const oslo = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit'
});
const weekdays = ['Sundag', 'Måndag', 'Tysdag', 'Onsdag', 'Torsdag', 'Fredag', 'Laurdag'];
const months = ['januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember'];

export function osloDay(date = new Date()) {
  const parts = Object.fromEntries(oslo.formatToParts(date).map(part => [part.type, part.value]));
  return parts.year + '-' + parts.month + '-' + parts.day;
}

export function dayLabel(day) {
  const date = new Date(day + 'T00:00:00Z');
  return weekdays[date.getUTCDay()] + ' ' + date.getUTCDate() + '. ' +
    months[date.getUTCMonth()] + ' ' + date.getUTCFullYear();
}

export function randomFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function shuffledAxis(random) {
  const groups = [0, 1, 2];
  return shuffle(groups, random).flatMap(group => shuffle(groups, random).map(i => group * 3 + i));
}

export function dailyPuzzle(day, level, catalogue) {
  const puzzles = catalogue[level];
  const dayNumber = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
  const index = (dayNumber % puzzles.length + puzzles.length) % puzzles.length;
  const [puzzle, solution] = puzzles[index];
  const random = randomFrom(hash(day + ':' + level));
  const replacements = [0, ...shuffle(digits, random)];
  const rows = shuffledAxis(random);
  const cols = shuffledAxis(random);
  const transpose = random() < 0.5;

  function transform(board) {
    return cells.map(({ row, col }) => {
      const r = transpose ? rows[col] : rows[row];
      const c = transpose ? cols[row] : cols[col];
      return replacements[Number(board[r * 9 + c])];
    });
  }

  return { puzzle: transform(puzzle), solution: transform(solution) };
}
