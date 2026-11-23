const assert = require('node:assert/strict');
const test = require('node:test');
const { importCsv, summarize, byRegion, exportCsv } = require('../delivery-data.js');

const header = 'shipment_id,region,dispatched_on,promised_on,delivered_on';
const source = (rows) => [header, ...rows].join('\r\n');

test('reads BOM, escaped quotes, commas and CRLF', () => {
  const { shipments, issues } = importCsv(`\uFEFF${source(['D-1,"North, ""A""",2026-01-01,2026-01-02,2026-01-02'])}`);
  assert.equal(shipments[0].region, 'North, "A"');
  assert.equal(shipments[0].status, 'onTime');
  assert.deepEqual(issues, []);
});

test('rejects invalid dates, duplicate IDs, bad date order and uneven records', () => {
  const { shipments, issues } = importCsv(source([
    'D-1,North,2026-01-01,2026-01-03,2026-01-03',
    'D-2,North,2026-02-30,2026-03-03,',
    'd-1,North,2026-01-01,2026-01-03,',
    'D-3,North,2026-01-10,2026-01-09,',
    'D-4,North,2026-01-10,2026-01-12',
  ]));
  assert.equal(shipments.length, 1);
  assert.deepEqual(issues.map((row) => row.record), [3, 4, 5, 6]);
});

test('reports broken CSV quoting and missing headers', () => {
  assert.throws(() => importCsv(source(['D-1,"North'])), /Unclosed quote/);
  assert.throws(() => importCsv(source(['D-1,"North"bad,2026-01-01,2026-01-03,'])), /Invalid CSV quoting/);
  assert.throws(() => importCsv('id,region\na,b'), /Provide one column/);
});

test('uses completed shipments as the on-time denominator', () => {
  const { shipments } = importCsv(source([
    'D-1,North,2026-01-01,2026-01-03,2026-01-01',
    'D-2,North,2026-01-01,2026-01-03,2026-01-04',
    'D-3,South,2026-01-01,2026-01-03,',
  ]));
  assert.deepEqual(summarize(shipments), { onTime: 1, late: 1, open: 1, total: 3, completed: 2, onTimeRate: 0.5 });
  assert.deepEqual(byRegion(shipments).map(({ region, onTimeRate }) => [region, onTimeRate]), [['North', 0.5], ['South', null]]);
});

test('accepts multiline CSV fields in extra columns and exports clean records', () => {
  const { shipments } = importCsv(`${header},note\r\nD-1,"North, A",2026-01-01,2026-01-03,,"on\nhold"`);
  assert.equal(shipments.length, 1);
  assert.deepEqual(importCsv(exportCsv(shipments)).shipments, shipments);
});

test('prefixes formula-like region values for spreadsheet export', () => {
  const { shipments } = importCsv(source(['D-1,=1+1,2026-01-01,2026-01-03,']));
  assert.match(exportCsv(shipments), /"'=1\+1"/);
});
