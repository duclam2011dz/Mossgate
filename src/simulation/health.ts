export type CombatStatus = 'poison' | 'slow';
export interface DirectHit {
  id: string;
  damage: number;
  direction: number;
  status?: CombatStatus;
}
/** Player-only health. Enemy actors intentionally own no health component. */
export class PlayerHealth {
  hp = 100;
  immunity = 0;
  poison = 0;
  slow = 0;
  poisonTick = 1;
  recoil = 0;
  reset(protection = 1) {
    this.hp = 100;
    this.immunity = protection;
    this.poison = 0;
    this.slow = 0;
    this.poisonTick = 1;
    this.recoil = 0;
  }
  update(dt: number) {
    this.immunity = Math.max(0, this.immunity - dt);
    this.recoil = Math.max(0, this.recoil - dt);
    this.slow = Math.max(0, this.slow - dt);
    if (this.poison > 0) {
      this.poisonTick -= Math.min(dt, this.poison);
      this.poison = Math.max(0, this.poison - dt);
      while (this.poisonTick <= 1e-8) {
        this.hp = Math.max(0, this.hp - 5);
        this.poisonTick += 1;
      }
    }
  }
  apply(hits: DirectHit[]): DirectHit | null {
    if (this.immunity > 0 || this.hp === 0 || !hits.length) return null;
    const hit = [...hits].sort(
      (a, b) => b.damage - a.damage || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )[0];
    if (!hit) return null;
    this.hp = Math.max(0, this.hp - hit.damage);
    this.immunity = 0.7;
    this.recoil = 0.12;
    if (hit.status === 'poison') {
      if (this.poison === 0) this.poisonTick = 1;
      this.poison = 4;
    }
    if (hit.status === 'slow') this.slow = 3;
    return hit;
  }
}
