import assert from 'node:assert/strict';
import { safeReturn, withBack, returnFromSearch, buildHref, isIsoDate, checkRange, setNavScope, rememberScroll, recallScroll, navMemorySize, clearNavMemory } from '../src/lib/nav';

// safeReturn
assert.equal(safeReturn('/'), '/');
assert.equal(safeReturn('/jobs'), '/jobs');
assert.equal(safeReturn('/jobs?status=closed&search=A-1'), '/jobs?search=A-1&status=closed');
assert.equal(safeReturn('/?from=2024-01-01&to=2024-02-01'), '/?from=2024-01-01&to=2024-02-01');
assert.equal(safeReturn('/?evil=1'), '/');
assert.equal(safeReturn('//evil.com'), null);
assert.equal(safeReturn('https://evil.com/jobs'), null);
assert.equal(safeReturn('/\\evil.com'), null);
assert.equal(safeReturn('/jobs/abc'), null);
assert.equal(safeReturn('/settings'), null);
assert.equal(safeReturn('javascript:alert(1)'), null);
assert.equal(safeReturn('/jobs\n'), null);
assert.equal(safeReturn(''), null);
assert.equal(safeReturn(null), null);
assert.equal(safeReturn('/' + 'a'.repeat(700)), null);

// withBack / returnFromSearch round-trip
const href = withBack('/jobs/42', '/jobs?status=draft');
assert.equal(href, '/jobs/42?back=%2Fjobs%3Fstatus%3Ddraft');
assert.equal(returnFromSearch(href.split('?')[1]), '/jobs?status=draft');
assert.equal(withBack('/jobs/42', '//evil'), '/jobs/42');
assert.equal(withBack('/jobs/42/edit?x=1', '/'), '/jobs/42/edit?x=1&back=%2F');
assert.equal(returnFromSearch('back=https%3A%2F%2Fevil.com'), null);
assert.equal(returnFromSearch(''), null);

// buildHref
assert.equal(buildHref('/jobs', { search: '', status: 'closed' }), '/jobs?status=closed');
assert.equal(buildHref('/', {}), '/');

// dates
assert.ok(isIsoDate('2024-02-29'));
assert.ok(!isIsoDate('2023-02-29'));
assert.ok(!isIsoDate('2024-13-01'));
assert.ok(!isIsoDate('0002-01-01'));
assert.ok(!isIsoDate('2024-1-1'));
assert.deepEqual(checkRange('', ''), { ok: true, from: '', to: '' });
assert.deepEqual(checkRange('2024-01-01', ''), { ok: true, from: '2024-01-01', to: '' });
assert.deepEqual(checkRange('2024-02-01', '2024-01-01'), { ok: false, reason: 'order' });
assert.deepEqual(checkRange('2024-02-31', ''), { ok: false, reason: 'bad_date' });
assert.deepEqual(checkRange('2024-01-01', '2024-01-01'), { ok: true, from: '2024-01-01', to: '2024-01-01' });

// scroll memory scoping
setNavScope('ws1|manager|u');
rememberScroll('/jobs', 420);
assert.equal(recallScroll('/jobs'), 420);
setNavScope('ws1|manager|u');
assert.equal(recallScroll('/jobs'), 420);
setNavScope('ws2|worker|u');
assert.equal(recallScroll('/jobs'), null);
assert.equal(navMemorySize(), 0);
rememberScroll('/', 10);
clearNavMemory();
assert.equal(recallScroll('/'), null);
setNavScope(null);
rememberScroll('/', 5);
assert.equal(navMemorySize(), 0);

console.log('nav helpers: all assertions passed');
