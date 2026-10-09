/**
 * Engine-neutral top-down enemy logic. Distances are world units and time is seconds.
 * The 360-degree detector is deliberately omnidirectional and ignores obstacles.
 * The caller handles rendering, collisions, and any world boundary constraints.
 */

export const BarreleyeState = Object.freeze({
  IDLE: 'Idle',
  SCANNING: 'Scanning',
  ALARM: 'Alarm Phase',
});

const STATS = [
  'health', 'movementSpeed', 'detectionRadius', 'alertRadius',
  'pulseInterval', 'idleDuration', 'scanDuration', 'scanInterval',
  'alarmMemoryDuration',
];

export function validateBarreleyeStats(stats) {
  if (!stats || typeof stats !== 'object') throw new TypeError('Barreleye stats are required.');
  for (const key of STATS) {
    if (!Number.isFinite(stats[key]) || stats[key] <= 0) {
      throw new RangeError(`${key} must be a positive finite number.`);
    }
  }
  return { ...stats };
}

function validPosition(position) {
  return position && Number.isFinite(position.x) && Number.isFinite(position.y);
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * @typedef {{x: number, y: number}} Point
 * @typedef {{position: Point, alive?: boolean}} Player
 * @typedef {{position: Point, alive?: boolean, receiveAlert?: (point: Point) => void}} NearbyEnemy
 * @typedef {{player?: Player | null, enemies?: NearbyEnemy[], onPulse?: (event: {origin: Point, radius: number, recipients: NearbyEnemy[]}) => void}} World
 */

export class BarreleyeFish {
  /** @param {{position: Point, stats: object}} options */
  constructor({ position, stats }) {
    if (!validPosition(position)) throw new TypeError('A finite starting position is required.');
    this.stats = validateBarreleyeStats(stats);
    this.position = { x: position.x, y: position.y };
    this.health = this.stats.health;
    this.alive = true;
    this.state = BarreleyeState.IDLE;
    this.stateElapsed = 0;
    this.scanElapsed = 0;
    this.pulseElapsed = 0;
    this.lostElapsed = 0;
    this.lastKnownPlayerPosition = null;
    this.hasDirectContact = false;
  }

  /** True for any angle within the radius. No raycast or obstacle check occurs. */
  canDetect(player) {
    return this.alive && player?.alive !== false && validPosition(player?.position)
      && distanceSquared(this.position, player.position) <= this.stats.detectionRadius ** 2;
  }

  /** Alert every compatible, living enemy within alertRadius. No automatic relay chain. */
  triggerSonarPulse(world = {}) {
    if (!this.alive || !this.lastKnownPlayerPosition) return [];
    const recipients = [];
    for (const enemy of world.enemies ?? []) {
      if (enemy === this || enemy?.alive === false || !validPosition(enemy?.position)
        || typeof enemy.receiveAlert !== 'function') continue;
      if (distanceSquared(this.position, enemy.position) <= this.stats.alertRadius ** 2) {
        enemy.receiveAlert({ ...this.lastKnownPlayerPosition });
        recipients.push(enemy);
      }
    }
    world.onPulse?.({ origin: { ...this.position }, radius: this.stats.alertRadius, recipients });
    return recipients;
  }

  /** An ally can enter alarm from a received target position; it does not relay the pulse. */
  receiveAlert(playerPosition) {
    if (!this.alive || !validPosition(playerPosition)) return;
    this.lastKnownPlayerPosition = { ...playerPosition };
    this.lostElapsed = 0;
    this.hasDirectContact = false;
    if (this.state !== BarreleyeState.ALARM) this.enterState(BarreleyeState.ALARM);
  }

  takeDamage(amount) {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Damage must be nonnegative and finite.');
    if (!this.alive) return this.health;
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) {
      this.alive = false;
      this.hasDirectContact = false;
    }
    return this.health;
  }

  enterState(state) {
    this.state = state;
    this.stateElapsed = 0;
    if (state === BarreleyeState.SCANNING) this.scanElapsed = this.stats.scanInterval;
    if (state === BarreleyeState.ALARM) this.pulseElapsed = 0;
    if (state === BarreleyeState.IDLE) {
      this.hasDirectContact = false;
      this.lastKnownPlayerPosition = null;
    }
  }

  moveToward(target, dt) {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;
    const step = Math.min(distance, this.stats.movementSpeed * dt);
    this.position.x += (dx / distance) * step;
    this.position.y += (dy / distance) * step;
  }

  /**
   * Advance the state machine. Call once per game tick with elapsed seconds.
   * Returns the current state for animation selection.
   * @param {number} dt
   * @param {World} world
   */
  update(dt, world = {}) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be nonnegative and finite.');
    if (!this.alive || dt === 0) return this.state;
    this.stateElapsed += dt;

    if (this.state === BarreleyeState.IDLE) {
      if (this.stateElapsed >= this.stats.idleDuration) this.enterState(BarreleyeState.SCANNING);
      return this.state;
    }

    if (this.state === BarreleyeState.SCANNING) {
      this.scanElapsed += dt;
      if (this.scanElapsed >= this.stats.scanInterval) {
        this.scanElapsed %= this.stats.scanInterval;
        if (this.canDetect(world.player)) {
          this.lastKnownPlayerPosition = { ...world.player.position };
          this.lostElapsed = 0;
          this.hasDirectContact = true;
          this.enterState(BarreleyeState.ALARM);
          this.triggerSonarPulse(world); // immediate first pulse on sighting
          return this.state;
        }
      }
      if (this.stateElapsed >= this.stats.scanDuration) this.enterState(BarreleyeState.IDLE);
      return this.state;
    }

    if (this.state === BarreleyeState.ALARM) {
      const detected = this.canDetect(world.player);
      if (detected) {
        this.lastKnownPlayerPosition = { ...world.player.position };
        this.lostElapsed = 0;
        if (!this.hasDirectContact) {
          this.hasDirectContact = true;
          this.pulseElapsed = 0;
          this.triggerSonarPulse(world);
        } else {
          this.pulseElapsed += dt;
          if (this.pulseElapsed >= this.stats.pulseInterval) {
            this.pulseElapsed %= this.stats.pulseInterval;
            this.triggerSonarPulse(world);
          }
        }
      } else {
        this.hasDirectContact = false;
        this.lostElapsed += dt;
        if (this.lostElapsed >= this.stats.alarmMemoryDuration) {
          this.enterState(BarreleyeState.IDLE);
          return this.state;
        }
      }
      if (this.lastKnownPlayerPosition) this.moveToward(this.lastKnownPlayerPosition, dt);
    }
    return this.state;
  }
}
