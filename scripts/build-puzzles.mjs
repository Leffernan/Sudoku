import { readFileSync, writeFileSync } from 'node:fs';
import { cells, digits, randomFrom, shuffle } from '../puzzle.mjs';

const fullMask = 0x3fe;
const indexes = cells.map((_, index) => index);
const units = ['row', 'col', 'box'].flatMap(key =>
  indexes.slice(0, 9).map(n => indexes.filter(i => cells[i][key] === n))
);
const popcount = Array.from({ length: fullMask + 1 }, (_, n) => n.toString(2).replace(/0/g, '').length);

function candidates(board) {
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  for (const index of indexes) {
    const value = board[index];
    if (!value) continue;
    const { row, col, box } = cells[index];
    const bit = 1 << value;
    if ((rows[row] | cols[col] | boxes[box]) & bit) return null;
    rows[row] |= bit;
    cols[col] |= bit;
    boxes[box] |= bit;
  }
  return cells.map(({ row, col, box }, i) => board[i] ? 0 : fullMask & ~(rows[row] | cols[col] | boxes[box]));
}

function search(board, limit, random) {
  let count = 0;
  let solution;
  function visit() {
    const options = candidates(board);
    if (!options) return;
    let index = -1;
    let fewest = 10;
    for (const i of indexes) {
      if (board[i]) continue;
      const possible = popcount[options[i]];
      if (possible === 0) return;
      if (possible < fewest) {
        index = i;
        fewest = possible;
      }
    }
    if (index === -1) {
      count++;
      solution = [...board];
      return;
    }

    const ordered = random ? shuffle(digits, random) : digits;
    for (const digit of ordered) {
      if (!(options[index] & (1 << digit))) continue;
      board[index] = digit;
      visit();
      if (count >= limit) break;
    }
    board[index] = 0;
  }
  visit();
  return { count, solution };
}

function solveUsingSingles(puzzle, allowHidden) {
  const board = [...puzzle];
  while (board.includes(0)) {
    const options = candidates(board);
    if (!options) return false;
    const single = options.findIndex(mask => popcount[mask] === 1);
    if (single !== -1) {
      board[single] = Math.log2(options[single]);
      continue;
    }
    if (!allowHidden) return false;

    let found = false;
    for (const unit of units) {
      for (const digit of digits) {
        const spots = unit.filter(i => options[i] & (1 << digit));
        if (spots.length !== 1) continue;
        board[spots[0]] = digit;
        found = true;
        break;
      }
      if (found) break;
    }
    if (!found) return false;
  }
  return true;
}

function difficulty(puzzle) {
  if (solveUsingSingles(puzzle, false)) return 'easy';
  return solveUsingSingles(puzzle, true) ? 'medium' : 'hard';
}

const ranges = { easy: [37, 41], medium: [31, 36], hard: [24, 31] };

function generate() {
  const random = randomFrom(0xa4014bb2);
  const catalogue = {};
  for (const [level, [min, max]] of Object.entries(ranges)) {
    const collection = new Map();
    for (let attempt = 0; attempt < 3000 && collection.size < 48; attempt++) {
      const { solution } = search(Array(81).fill(0), 1, random);
      const puzzle = [...solution];
      const clues = min + Math.floor(random() * (max - min + 1));
      let remaining = puzzle.length;
      for (const index of shuffle(indexes, random)) {
        if (remaining === clues) break;
        puzzle[index] = 0;
        if (search(puzzle, 2).count === 1) remaining--;
        else puzzle[index] = solution[index];
      }
      if (remaining === clues && difficulty(puzzle) === level) {
        collection.set(puzzle.join(''), solution.join(''));
      }
    }
    if (collection.size !== 48) throw new Error('Fann ikkje nok brett for ' + level);
    catalogue[level] = [...collection];
  }
  return catalogue;
}

function verify(catalogue) {
  const seen = new Set();
  for (const [level, [min, max]] of Object.entries(ranges)) {
    const entries = catalogue[level];
    if (!Array.isArray(entries) || entries.length !== 48) throw new Error('Feil tal på brett for ' + level);
    for (const [source, expected] of entries) {
      const puzzle = [...source].map(Number);
      const clues = puzzle.filter(Boolean).length;
      const result = search(puzzle, 2);
      if (!/^[0-9]{81}$/.test(source) || seen.has(source) || clues < min || clues > max ||
          result.count !== 1 || result.solution.join('') !== expected || difficulty(puzzle) !== level) {
        throw new Error('Ugyldig brett for ' + level + ': ' + source);
      }
      seen.add(source);
    }
  }
  console.log('Verifiserte ' + seen.size + ' brett med éi løysing og rett nivå.');
}

const file = new URL('../puzzles.mjs', import.meta.url);
if (process.argv.includes('--check')) {
  const data = readFileSync(file, 'utf8').trim().replace(/^.*?export default /s, '').replace(/;$/, '');
  verify(JSON.parse(data));
} else {
  const catalogue = generate();
  verify(catalogue);
  const objects = Object.entries(catalogue).map(([level, pairs]) =>
    '  "' + level + '": [\n' + pairs.map(pair => '    ' + JSON.stringify(pair)).join(',\n') + '\n  ]'
  );
  writeFileSync(file, '// Generated by scripts/build-puzzles.mjs\nexport default {\n' + objects.join(',\n') + '\n};\n');
}
