const test = require('node:test');
const assert = require('node:assert/strict');

const Outgoing = require('../src/entity/Outgoing');
const Incoming = require('../src/entity/Incoming');
const Reception = require('../src/entity/Reception');

test('Outgoing, Incoming and Reception entities expose lockable fields', () => {
  assert.ok(Outgoing.columns && Outgoing.columns.status, 'Outgoing should define status column');
  assert.ok(Outgoing.columns && Outgoing.columns.lockedAt, 'Outgoing should define lockedAt column');

  assert.ok(Incoming.columns && Incoming.columns.status, 'Incoming should define status column');
  assert.ok(Incoming.columns && Incoming.columns.lockedAt, 'Incoming should define lockedAt column');

  assert.ok(Reception.columns && Reception.columns.status, 'Reception should define status column');
  assert.ok(Reception.columns && Reception.columns.lockedAt, 'Reception should define lockedAt column');
});
