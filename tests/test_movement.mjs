import assert from 'node:assert/strict';
import { stepMovement } from '../web/movement.js';
const open = { move: (x, z, dx, dz) => [x + dx, z + dz] };
const first = stepMovement([0, 0], [0, 0], [0, 1], 0, 3.2, 1 / 60, open, 0.35);
assert.ok(first.velocity[1] < 0 && first.velocity[1] > -3.2, '平滑起步');
let current = first;
for (let i = 0; i < 60; i++) current = stepMovement(current.position, current.velocity, [0, 0], 0, 3.2, 1 / 60, open, 0.35);
assert.deepEqual(current.velocity, [0, 0], '放開後迅速停穩');
const wall = { move: (x, z) => [x, z] };
const blocked = stepMovement([0, 0], [0, -3.2], [0, 1], 0, 3.2, 0.05, wall, 0.35);
assert.equal(blocked.blocked, true); assert.deepEqual(blocked.velocity, [0, 0]);
const slide = stepMovement([0, 0], [0, 0], [0, 1], Math.PI / 4, 3.2, 0.05,
  { move: (x, z, dx, dz) => [x, z + dz] }, 0.35);
assert.equal(slide.collided, true, '斜撞牆也通知自動前進停止');
assert.equal(slide.blocked, false, '手動仍能沿牆滑行');
const calls = [];
stepMovement([0, 0], [0, -7], [0, 1], 0, 7, 0.05, { move: (x, z, dx, dz) => { calls.push(Math.hypot(dx, dz)); return [x + dx, z + dz]; } }, 0.35);
assert.ok(calls.every((distance) => distance <= 0.12), '高速碰撞分步');
function atFps(fps) {
  let value = { position: [0, 0], velocity: [0, 0] };
  for (let i = 0; i < fps; i++) value = stepMovement(value.position, value.velocity, [0, 1], 0, 3.2, 1 / fps, open, 0.35);
  return value.position[1];
}
assert.ok(Math.abs(atFps(30) - atFps(120)) < 0.05, '不同幀率行程一致');
console.log('ok: 平滑起停、撞牆歸零、分步碰撞、幀率一致');
