import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BarreleyeFish, BarreleyeState } from '../src/enemies/barreleye-fish.js';

const stats = JSON.parse(await readFile(new URL('../src/enemies/barreleye-fish.stats.json', import.meta.url)));
const fish = (position = { x: 0, y: 0 }) => new BarreleyeFish({ position, stats });

test('configuration exposes all tunable stats', () => {
  for (const key of ['health', 'movementSpeed', 'detectionRadius', 'alertRadius', 'pulseInterval']) {
    assert.ok(stats[key] > 0, key);
  }
  assert.throws(() => new BarreleyeFish({ position: { x: 0, y: 0 }, stats: { ...stats, pulseInterval: 0 } }), /pulseInterval/);
});

test('idle advances to scanning and detects a player from any direction through obstacles', () => {
  for (const position of [
    { x: 0, y: -100 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: -100, y: 0 },
  ]) {
    const enemy = fish();
    const world = { player: { position }, obstacles: [{ x: 0, y: 0, solid: true }], enemies: [] };
    assert.equal(enemy.update(stats.idleDuration, world), BarreleyeState.SCANNING);
    assert.equal(enemy.update(0.01, world), BarreleyeState.ALARM);
    assert.deepEqual(enemy.lastKnownPlayerPosition, position);
  }
});

test('player outside radius is ignored and scanning returns to idle', () => {
  const enemy = fish();
  const world = { player: { position: { x: stats.detectionRadius + 1, y: 0 } } };
  enemy.update(stats.idleDuration, world);
  assert.equal(enemy.update(stats.scanDuration, world), BarreleyeState.IDLE);
  assert.equal(enemy.lastKnownPlayerPosition, null);
  assert.equal(enemy.canDetect({ position: { x: stats.detectionRadius, y: 0 } }), true);
});

test('sonar alerts all living compatible enemies within radius exactly once', () => {
  const source = fish();
  const near = fish({ x: stats.alertRadius, y: 0 });
  const far = fish({ x: stats.alertRadius + 1, y: 0 });
  const dead = fish({ x: 1, y: 0 });
  dead.takeDamage(stats.health);
  const pulses = [];
  const player = { position: { x: 20, y: 0 } };
  const world = { player, enemies: [source, near, far, dead], onPulse: (event) => pulses.push(event) };
  source.update(stats.idleDuration, world);
  source.update(0.01, world);
  assert.equal(pulses.length, 1);
  assert.deepEqual(pulses[0].recipients, [near]);
  assert.equal(near.state, BarreleyeState.ALARM);
  assert.equal(far.state, BarreleyeState.IDLE);
  assert.equal(dead.state, BarreleyeState.IDLE);
  assert.deepEqual(near.lastKnownPlayerPosition, player.position);
  assert.equal(near.hasDirectContact, false);
});

test('pulses repeat at the interval only during direct contact and do not relay on alert', () => {
  const source = fish();
  const ally = fish({ x: 10, y: 0 });
  const pulses = [];
  const world = { player: { position: { x: 30, y: 0 } }, enemies: [source, ally], onPulse: (event) => pulses.push(event) };
  source.update(stats.idleDuration, world);
  source.update(0.01, world);
  assert.equal(pulses.length, 1);
  source.update(stats.pulseInterval - 0.1, world);
  assert.equal(pulses.length, 1);
  source.update(0.1, world);
  assert.equal(pulses.length, 2);
  world.player.position = { x: 1000, y: 0 };
  source.update(stats.pulseInterval, world);
  assert.equal(pulses.length, 2);
  assert.equal(source.hasDirectContact, false);
});

test('alarm movement follows target without overshoot and forgets after memory expires', () => {
  const enemy = fish();
  enemy.receiveAlert({ x: 10, y: 0 });
  assert.equal(enemy.state, BarreleyeState.ALARM);
  enemy.update(1, { enemies: [] });
  assert.deepEqual(enemy.position, { x: 10, y: 0 });
  enemy.update(stats.alarmMemoryDuration, { enemies: [] });
  assert.equal(enemy.state, BarreleyeState.IDLE);
  assert.equal(enemy.lastKnownPlayerPosition, null);
});

test('health reaches zero and dead fish no longer detects, moves, or pulses', () => {
  const enemy = fish();
  assert.equal(enemy.takeDamage(stats.health + 5), 0);
  assert.equal(enemy.alive, false);
  assert.equal(enemy.canDetect({ position: { x: 0, y: 0 } }), false);
  assert.equal(enemy.update(10, { player: { position: { x: 0, y: 0 } } }), BarreleyeState.IDLE);
  assert.deepEqual(enemy.triggerSonarPulse({ enemies: [] }), []);
  assert.throws(() => enemy.takeDamage(-1), /nonnegative/);
});
