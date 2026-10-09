/** 短促、與幀率無關的加減速；小步碰撞避免高速穿过窄柱。 */
export function stepMovement(position, velocity, input, yaw, speed, dt, collider, radius) {
  const duration = Math.max(0, Math.min(0.05, dt));
  const length = Math.max(1, Math.hypot(input[0], input[1]));
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const target = [(input[0] * cos - input[1] * sin) / length * speed,
    (-input[0] * sin - input[1] * cos) / length * speed];
  const blend = 1 - Math.exp(-duration * (input[0] || input[1] ? 14 : 24));
  const nextVelocity = velocity.map((v, i) => v + (target[i] - v) * blend);
  if (Math.hypot(...nextVelocity) < 0.02) nextVelocity.fill(0);
  const steps = Math.max(1, Math.ceil(Math.hypot(...nextVelocity) * duration / 0.12));
  let nextPosition = [...position];
  let collided = false;
  for (let i = 0; i < steps; i++) {
    const dx = nextVelocity[0] * duration / steps, dz = nextVelocity[1] * duration / steps;
    const moved = collider.move(...nextPosition, dx, dz, radius);
    if (Math.hypot(moved[0] - nextPosition[0] - dx, moved[1] - nextPosition[1] - dz) > 0.000001) collided = true;
    nextPosition = moved;
  }
  const blocked = Math.hypot(nextPosition[0] - position[0], nextPosition[1] - position[1]) < 0.0001 && Math.hypot(...target) > 0;
  return { position: nextPosition, velocity: blocked ? [0, 0] : nextVelocity, blocked, collided };
}
