const path = require('path');
const {
  parseCRU,
  sallesForCourse,
  capacityOfRoom,
  freeSlotsForRoom,
  roomsAvailableForCreneau,
  verifyNoOverlap,
  generateOccupationCSV,
  rankByCapacity
} = require('../sru-tool');

const SAMPLE = path.join(__dirname, '..', 'sample.cru');

test('parseCRU returns entries', () => {
  const cru = parseCRU(SAMPLE);
  expect(cru.length).toBeGreaterThanOrEqual(5);
});

test('sallesForCourse GL02', () => {
  const cru = parseCRU(SAMPLE);
  const res = sallesForCourse(cru, 'GL02');
  expect(Array.isArray(res)).toBe(true);
  expect(res.length).toBeGreaterThan(0);
});

test('capacityOfRoom C006', () => {
  const cru = parseCRU(SAMPLE);
  const cap = capacityOfRoom(cru, 'C006');
  expect(cap).toBeGreaterThan(0);
});

test('freeSlotsForRoom returns map', () => {
  const cru = parseCRU(SAMPLE);
  const free = freeSlotsForRoom(cru, 'C006');
  expect(free).toHaveProperty('L');
});

test('roomsAvailableForCreneau works', () => {
  const cru = parseCRU(SAMPLE);
  const rooms = roomsAvailableForCreneau(cru, 'L H=12:00-13:00');
  expect(Array.isArray(rooms)).toBe(true);
});

test('verifyNoOverlap returns array', () => {
  const cru = parseCRU(SAMPLE);
  const viol = verifyNoOverlap(cru);
  expect(Array.isArray(viol)).toBe(true);
});

test('generateOccupationCSV creates file', () => {
  const cru = parseCRU(SAMPLE);
  const out = generateOccupationCSV(cru, 'data');
  const fs = require('fs');
  expect(fs.existsSync(out)).toBe(true);
});

test('rankByCapacity returns sorted list', () => {
  const cru = parseCRU(SAMPLE);
  const ranking = rankByCapacity(cru);
  expect(Array.isArray(ranking)).toBe(true);
});
