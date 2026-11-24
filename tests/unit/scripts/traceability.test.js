// The traceability generator (npm run trace) reads stories and test titles correctly.
const fs = require('node:fs');
const path = require('node:path');
const {
  readStories,
  collectTests,
  buildMatrix,
  statusOf,
} = require('../../../scripts/traceability');

const writeTest = (dir, name, source) => {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
  return file;
};

describe('traceability script', () => {
  it('reads story rows (ID, FR, owner) and ignores other lines', () => {
    const markdown = [
      '| ID | FR | Owner | Story |',
      '| --- | --- | --- | --- |',
      '| US7-1 | FR7 | Youssef | As a manager … |',
      '| NFR7 | FR7 | Youssef | Performance |',
      'Some text with US9-9 in it',
    ].join('\n');

    expect(readStories(markdown)).toEqual([
      { id: 'US7-1', fr: 'FR7', owner: 'Youssef' },
      { id: 'NFR7', fr: 'FR7', owner: 'Youssef' },
    ]);
  });

  it('finds IDs in describe, it, test and it.each titles, split into unit and e2e', () => {
    const root = path.join(__dirname, '../../..');
    const dir = fs.mkdtempSync(path.join(root, 'tests', 'tmp-trace-'));
    try {
      const unit = writeTest(
        dir,
        'a.test.js',
        "describe('US1-1 things', () => {\n  it.each([[1, 2]])('US2-1 %s', () => {});\n  // US3-1 only in a comment\n});",
      );
      const e2e = writeTest(
        path.join(root, 'tests', 'e2e'),
        'tmp-trace.spec.js',
        "test('US1-1 in a browser', () => {});",
      );
      try {
        const found = collectTests([unit, e2e]);

        expect([...found.keys()].sort()).toEqual(['US1-1', 'US2-1']);
        expect(found.get('US1-1').e2e.size).toBe(1);
        expect(found.get('US2-1').e2e.size).toBe(0);
      } finally {
        fs.rmSync(e2e);
      }
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  // Decision table: unit/integration test? × E2E test? → status
  it.each([
    [true, true, '✅'],
    [true, false, '⚠️'],
    [false, true, '⚠️'],
    [false, false, '❌'],
  ])('unit %s, e2e %s → %s', (hasUnit, hasE2e, expected) => {
    const files = (has) => new Set(has ? ['x'] : []);

    expect(statusOf({ unit: files(hasUnit), e2e: files(hasE2e) })).toBe(expected);
  });

  it('an NFR is covered by unit/integration tests alone', () => {
    expect(statusOf({ unit: new Set(['x']), e2e: new Set() }, false)).toBe('✅');
    expect(statusOf({ unit: new Set(), e2e: new Set() }, false)).toBe('❌');
  });

  it('lists every story not fully covered as missing', () => {
    const stories = [
      { id: 'US1-1', fr: 'FR1', owner: 'A' },
      { id: 'US1-2', fr: 'FR1', owner: 'A' },
    ];
    const found = new Map([['US1-1', { unit: new Set(['u']), e2e: new Set(['e']) }]]);

    const { markdown, missing } = buildMatrix(stories, found);

    expect(missing.map((row) => row.id)).toEqual(['US1-2']);
    expect(markdown).toContain('Covered: **1 of 2**');
  });
});
