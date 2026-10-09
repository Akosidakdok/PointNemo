# Barreleye Fish enemy

`barreleye-fish.js` contains an engine-neutral state machine; `barreleye-fish.stats.json` holds its tunable stats. All time values are **seconds**. Distances and speed use your game's world units and world units per second.

| State | Behavior |
| --- | --- |
| Idle | Waits for `idleDuration`; then enters Scanning. |
| Scanning | Checks a full 360° radius every `scanInterval`. Obstacles do not block detection. A sighting enters Alarm Phase and sends an immediate sonar pulse. After `scanDuration` with no sighting, returns to Idle. |
| Alarm Phase | Pursues the current or last known player position at `movementSpeed`. While the player remains in detection range, repeats sonar pulses every `pulseInterval`. After losing contact for `alarmMemoryDuration`, returns to Idle. |

`health` is maximum HP, `detectionRadius` controls sight, and `alertRadius` controls the sonar broadcast. An alerted ally enters Alarm Phase with the reported target position, but does not automatically relay the pulse. The `onPulse` callback is for sound and visual effects.

```js
import { BarreleyeFish, BarreleyeState } from './barreleye-fish.js';
import stats from './barreleye-fish.stats.json' with { type: 'json' };

const enemies = [
  new BarreleyeFish({ position: { x: 100, y: 120 }, stats }),
  new BarreleyeFish({ position: { x: 280, y: 120 }, stats }),
];

const player = { position: { x: 200, y: 160 }, alive: true };

function update(dtSeconds) {
  for (const enemy of enemies) {
    enemy.update(dtSeconds, {
      player,
      enemies,
      onPulse: ({ origin, radius }) => {
        // Render expanding sonar ring and play sonar audio here.
        showSonarRing(origin, radius);
      },
    });

    if (!enemy.alive) continue;
    const animation = enemy.state === BarreleyeState.ALARM ? 'swim-fast'
      : enemy.state === BarreleyeState.SCANNING ? 'scan' : 'idle';
    drawBarreleye(enemy.position, animation);
  }
}
```

Pass **elapsed seconds**, not milliseconds, to `update`. Rendering and physics are separate: if obstacles should block the fish's movement, apply collision resolution after each update. Detection intentionally ignores those obstacles, including walls and reefs. The module does not yet include combat attacks or damage dealt to the player.

For a browser bundle, import the JSON using your bundler's supported JSON import syntax if it differs from the example. Tests run with `npm test`.
