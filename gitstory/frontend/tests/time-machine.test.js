/**
 * time-machine.test.js
 * Unit tests for Repository Time Machine calculation logic.
 * Run with: node --test frontend/tests/time-machine.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sortCommitsChronological,
  filterCommitsByDateRange,
  calculateTimeDifference,
  calculateCommitComparison,
} = require('../assets/js/time-machine.js');

test('Time Machine: sortCommitsChronological sorts oldest to newest', () => {
  const unsorted = [
    { sha: 'c3', date: '2026-10-15T12:00:00Z', message: 'Third' },
    { sha: 'c1', date: '2026-10-01T10:00:00Z', message: 'First' },
    { sha: 'c2', date: '2026-10-10T08:00:00Z', message: 'Second' },
  ];

  const sorted = sortCommitsChronological(unsorted);
  assert.equal(sorted.length, 3);
  assert.equal(sorted[0].sha, 'c1');
  assert.equal(sorted[1].sha, 'c2');
  assert.equal(sorted[2].sha, 'c3');
});

test('Time Machine: sortCommitsChronological handles empty and invalid inputs gracefully', () => {
  assert.deepEqual(sortCommitsChronological([]), []);
  assert.deepEqual(sortCommitsChronological(null), []);
  assert.deepEqual(sortCommitsChronological(undefined), []);

  const missingDates = [
    { sha: 'a', message: 'No date' },
    { sha: 'b', date: '2026-01-01T00:00:00Z', message: 'Dated' },
  ];
  const sorted = sortCommitsChronological(missingDates);
  assert.equal(sorted.length, 2);
});

test('Time Machine: filterCommitsByDateRange filters correctly within date bounds', () => {
  const commits = [
    { sha: 'c1', date: '2026-01-01T00:00:00Z' },
    { sha: 'c2', date: '2026-06-01T00:00:00Z' },
    { sha: 'c3', date: '2026-10-01T00:00:00Z' },
  ];

  const mid = filterCommitsByDateRange(commits, '2026-05-01T00:00:00Z', '2026-07-01T00:00:00Z');
  assert.equal(mid.length, 1);
  assert.equal(mid[0].sha, 'c2');

  const after = filterCommitsByDateRange(commits, '2026-07-01T00:00:00Z', null);
  assert.equal(after.length, 1);
  assert.equal(after[0].sha, 'c3');

  const before = filterCommitsByDateRange(commits, null, '2026-05-01T00:00:00Z');
  assert.equal(before.length, 1);
  assert.equal(before[0].sha, 'c1');
});

test('Time Machine: calculateTimeDifference formats elapsed duration accurately', () => {
  const t1 = '2026-10-01T10:00:00Z';
  const t2 = '2026-10-04T14:30:00Z'; // 3 days, 4 hours
  const diffDays = calculateTimeDifference(t1, t2);
  assert.match(diffDays, /3 days/);
  assert.match(diffDays, /4 hrs?/);

  const t3 = '2026-10-01T10:00:00Z';
  const t4 = '2026-10-01T12:15:00Z'; // 2 hrs, 15 min
  const diffHours = calculateTimeDifference(t3, t4);
  assert.match(diffHours, /2 hrs?/);
  assert.match(diffHours, /15 min/);

  const t5 = '2026-10-01T10:00:00Z';
  const t6 = '2026-10-01T10:05:00Z'; // 5 minutes
  assert.equal(calculateTimeDifference(t5, t6), '5 minutes');

  // Handles invalid/null
  assert.equal(calculateTimeDifference(null, null), 'Unknown duration');
});

test('Time Machine: calculateCommitComparison computes comparison metadata correctly', () => {
  const commitA = {
    sha: '1111111',
    full_sha: '1111111222222333333444444555555666666777',
    message: 'Initial structure',
    author_name: 'Alice',
    author_login: 'alice',
    date: '2026-10-01T10:00:00Z',
  };
  const commitB = {
    sha: '8888888',
    full_sha: '8888888999999000000111111222222333333444',
    message: 'Feature addition',
    author_name: 'Bob',
    author_login: 'bob',
    date: '2026-10-05T12:00:00Z',
  };

  const comp = calculateCommitComparison(commitA, commitB, 'acme/project');
  assert.equal(comp.available, true);
  assert.equal(comp.base.sha, '1111111');
  assert.equal(comp.target.sha, '8888888');
  assert.equal(comp.sameAuthor, false);
  assert.match(comp.timeDiff, /4 days/);
  assert.equal(comp.compareUrl, 'https://github.com/acme/project/compare/1111111222222333333444444555555666666777...8888888999999000000111111222222333333444');
  assert.ok(comp.notice.length > 0);
});

test('Time Machine: calculateCommitComparison returns graceful unavailable state for invalid commits', () => {
  const comp = calculateCommitComparison(null, null, 'acme/project');
  assert.equal(comp.available, false);
  assert.ok(comp.message.includes('Select two commits'));
});
