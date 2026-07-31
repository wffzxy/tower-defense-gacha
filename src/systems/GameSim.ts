// 核心模拟系统：不依赖 Phaser，纯 TypeScript 状态机
// 负责怪物、塔、投射物、伤害、经济、波次的逻辑更新

import type { Monster, Tower, TowerDef, WaveDef, InventoryItem } from '../types';
import { MONSTERS } from '../data/monsters';
import { TOWER_MAP, GACHA_POOL } from '../data/towers';
import { getWave } from '../data/waves';
import { PathSystem } from './PathSystem';

export interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  speed: number;
  damage: number;
  splash: number;
  slowFactor: number;
  slowDuration: number;
  dot: number;
  dotDuration: number;
  chain: number;
  hitIds: number[];      // 已命中目标（用于连锁）
  color: number;
  radius: number;
  alive: boolean;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: number;
  bornAt: number;
  ttl: number;
}

export interface Beam {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: number;
  bornAt: number;
  ttl: number;
}

export type SimEvent =
  | { type: 'monster_killed'; monster: Monster; score: number; gold: number }
  | { type: 'monster_reached_base'; monster: Monster }
  | { type: 'wave_started'; wave: number }
  | { type: 'wave_completed'; wave: number; reward: number }
  | { type: 'game_over'; reason: string }
  | { type: 'projectile_fired'; from: Tower; target: Monster }
  | { type: 'gold_mined'; tower: Tower; amount: number };

export class GameSim {
  width: number;
  height: number;
  path: PathSystem;

  // 资源
  gold = 80;
  score = 0;
  baseHp = 20;
  maxBaseHp = 20;

  // 实体
  monsters: Monster[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  floatingTexts: FloatingText[] = [];
  beams: Beam[] = [];

  // 背包
  inventory: InventoryItem[] = [];

  // 波次
  waveNum = 0;
  currentWave: WaveDef | null = null;
  waveActive = false;
  spawnQueue: { kind: string; at: number }[] = [];
  waveStartTime = 0;
  monstersAliveInWave = 0;
  waveEnded = false;

  // 状态
  paused = false;
  gameOver = false;
  selectedTowerUid: number | null = null;   // 背包选中
  selectedPlacedId: number | null = null;   // 已放置塔选中

  // 事件
  events: SimEvent[] = [];

  // ID
  private nextMonsterId = 1;
  private nextTowerId = 1;
  private nextProjId = 1;
  private nextTextId = 1;
  private nextUid = 1;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.path = new PathSystem(width, height);
  }

  // ============ 抽卡 ============
  canGacha(pool: 'normal' | 'rare'): boolean {
    const cost = pool === 'normal' ? 10 : 50;
    return this.gold >= cost;
  }

  gacha(pool: 'normal' | 'rare'): TowerDef | null {
    const cost = pool === 'normal' ? 10 : 50;
    if (this.gold < cost) return null;
    this.gold -= cost;
    const poolDef = GACHA_POOL[pool];
    const total = poolDef.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    for (const entry of poolDef) {
      r -= entry.weight;
      if (r <= 0) {
        const item: InventoryItem = { uid: this.nextUid++, def: entry.def };
        this.inventory.push(item);
        return entry.def;
      }
    }
    const fallback = poolDef[0].def;
    this.inventory.push({ uid: this.nextUid++, def: fallback });
    return fallback;
  }

  // ============ 塔放置/出售 ============
  selectFromInventory(uid: number | null) {
    this.selectedTowerUid = uid;
    this.selectedPlacedId = null;
  }

  selectPlaced(id: number | null) {
    this.selectedPlacedId = id;
    this.selectedTowerUid = null;
  }

  canPlaceAt(x: number, y: number): boolean {
    if (x < 30 || y < 30 || x > this.width - 30 || y > this.height - 30) return false;
    if (this.path.isOnPath(x, y)) return false;
    // 不能与已有塔重叠
    for (const t of this.towers) {
      if (Math.hypot(t.x - x, t.y - y) < 32) return false;
    }
    return true;
  }

  placeTower(uid: number, x: number, y: number): boolean {
    const idx = this.inventory.findIndex(i => i.uid === uid);
    if (idx < 0) return false;
    const item = this.inventory[idx];
    if (!this.canPlaceAt(x, y)) return false;
    if (this.gold < item.def.cost) return false;
    this.gold -= item.def.cost;
    const tower: Tower = {
      id: this.nextTowerId++,
      def: item.def,
      x, y,
      lastFireAt: 0,
      lastTickAt: performance.now(),
      targetId: null,
      cooldownMs: item.def.fireRate ? 1000 / item.def.fireRate : 0
    };
    this.towers.push(tower);
    this.inventory.splice(idx, 1);
    this.selectedTowerUid = null;
    return true;
  }

  sellTower(id: number): boolean {
    const idx = this.towers.findIndex(t => t.id === id);
    if (idx < 0) return false;
    const t = this.towers[idx];
    const refund = Math.floor(t.def.cost * 0.5);
    this.gold += refund;
    this.towers.splice(idx, 1);
    this.selectedPlacedId = null;
    this.pushText(t.x, t.y, `+${refund}💰`, 0xf1c40f);
    return true;
  }

  // ============ 波次 ============
  startNextWave(): boolean {
    if (this.waveActive || this.gameOver) return false;
    this.waveNum++;
    const wave = getWave(this.waveNum);
    this.currentWave = wave;
    this.waveActive = true;
    this.waveEnded = false;
    this.waveStartTime = performance.now();
    this.monstersAliveInWave = 0;
    this.spawnQueue = [];
    for (const spawn of wave.spawns) {
      for (let i = 0; i < spawn.count; i++) {
        this.spawnQueue.push({
          kind: spawn.kind,
          at: spawn.delay + i * spawn.interval
        });
        this.monstersAliveInWave++;
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    this.events.push({ type: 'wave_started', wave: this.waveNum });
    return true;
  }

  private spawnMonster(kind: string) {
    const def = MONSTERS[kind];
    if (!def) return;
    const sp = this.path.spawnPoint;
    const m: Monster = {
      id: this.nextMonsterId++,
      def,
      hp: def.hp,
      maxHp: def.hp,
      pathIndex: 0,
      x: sp.x,
      y: sp.y,
      slowUntil: 0,
      slowFactor: 1,
      dotEndAt: 0,
      dotPerSec: 0,
      alive: true
    };
    this.monsters.push(m);
  }

  // ============ 主循环更新 ============
  update(dtMs: number, now: number) {
    if (this.paused || this.gameOver) return;
    const dt = dtMs / 1000;

    this.updateSpawns(now);
    this.updateMonsters(dt, now);
    this.updateTowers(now);
    this.updateProjectiles(dt, now);
    this.updateFloatingTexts(now);
    this.updateBeams(now);
    this.checkWaveComplete();
  }

  private updateSpawns(now: number) {
    if (!this.waveActive || this.spawnQueue.length === 0) return;
    const elapsed = now - this.waveStartTime;
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].at <= elapsed) {
      const s = this.spawnQueue.shift()!;
      this.spawnMonster(s.kind);
    }
  }

  private updateMonsters(dt: number, now: number) {
    const toRemove: number[] = [];
    for (const m of this.monsters) {
      if (!m.alive) continue;

      // DOT 伤害
      if (m.dotPerSec > 0 && now < m.dotEndAt) {
        m.hp -= m.dotPerSec * dt;
        if (m.hp <= 0) {
          this.killMonster(m, now);
          continue;
        }
      }

      // 寻路移动
      const target = this.path.nextTarget(m.x, m.y, m.pathIndex);
      if (!target || target.reachedEnd) {
        // 到达基地
        this.onMonsterReachBase(m);
        toRemove.push(m.id);
        continue;
      }
      let speed = m.def.speed;
      if (now < m.slowUntil) {
        speed *= m.slowFactor;
      }
      const dx = target.tx - m.x;
      const dy = target.ty - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.1) {
        const step = Math.min(dist, speed * dt);
        m.x += (dx / dist) * step;
        m.y += (dy / dist) * step;
      }
      m.pathIndex = target.nextIndex;
    }
    if (toRemove.length > 0) {
      this.monsters = this.monsters.filter(m => !toRemove.includes(m.id));
    }
  }

  private onMonsterReachBase(m: Monster) {
    const dmg = Math.max(1, Math.floor(m.def.hp / 40));
    this.baseHp -= dmg;
    this.events.push({ type: 'monster_reached_base', monster: m });
    this.pushText(this.path.basePoint.x, this.path.basePoint.y, `-${dmg}🏰`, 0xe74c3c);
    if (this.baseHp <= 0) {
      this.baseHp = 0;
      this.gameOver = true;
      this.events.push({ type: 'game_over', reason: '基地被摧毁' });
    }
  }

  private killMonster(m: Monster, now: number) {
    m.alive = false;
    let score = m.def.score;
    let gold = m.def.gold;
    // 魂矿加成
    const soulBonus = this.towers
      .filter(t => t.def.scoreBonus)
      .reduce((s, t) => s + t.def.scoreBonus!, 0);
    score = Math.floor(score * (1 + soulBonus));
    this.score += score;
    this.gold += gold;
    this.monstersAliveInWave--;
    this.pushText(m.x, m.y, `+${score}⭐`, 0xfeca57);
    if (gold > 0) this.pushText(m.x, m.y - 14, `+${gold}💰`, 0xf1c40f);
    this.events.push({ type: 'monster_killed', monster: m, score, gold });
  }

  private updateTowers(now: number) {
    for (const t of this.towers) {
      // 金矿/经济塔
      if (t.def.category === 'mine') {
        if (now - t.lastTickAt >= t.def.tickInterval!) {
          t.lastTickAt = now;
          const amount = t.def.goldPerTick!;
          this.gold += amount;
          this.pushText(t.x, t.y - 20, `+${amount}💰`, 0xf1c40f);
          this.events.push({ type: 'gold_mined', tower: t, amount });
        }
        continue;
      }

      // 辅助塔不直接攻击
      if (t.def.category === 'support') continue;

      // 计算实际射程/伤害（含辅助增益）
      const effRange = this.effRange(t);
      const effDamage = this.effDamage(t);

      // 寻找目标
      let target: Monster | null = null;
      let bestProgress = -1;
      for (const m of this.monsters) {
        if (!m.alive) continue;
        const d = Math.hypot(m.x - t.x, m.y - t.y);
        if (d > effRange) continue;
        // 优先打路径进度高的（最接近基地的）
        const progress = m.pathIndex + (1 - Math.hypot(m.x - this.path.basePoint.x, m.y - this.path.basePoint.y) / this.width);
        if (progress > bestProgress) {
          bestProgress = progress;
          target = m;
        }
      }

      if (target) {
        t.targetId = target.id;
        if (now - t.lastFireAt >= t.cooldownMs) {
          t.lastFireAt = now;
          this.fireProjectile(t, target, effDamage);
        }
      } else {
        t.targetId = null;
      }
    }
  }

  private effRange(t: Tower): number {
    if (!t.def.range) return 0;
    let r = t.def.range;
    for (const other of this.towers) {
      if (other.def.category !== 'support') continue;
      if (!other.def.buffRangeBonus) continue;
      if (!other.def.buffRange) continue;
      const d = Math.hypot(other.x - t.x, other.y - t.y);
      if (d <= other.def.buffRange) {
        r = t.def.range * (1 + other.def.buffRangeBonus);
      }
    }
    return r;
  }

  private effDamage(t: Tower): number {
    if (!t.def.damage) return 0;
    let dmg = t.def.damage;
    for (const other of this.towers) {
      if (other.def.category !== 'support') continue;
      if (!other.def.buffDamage) continue;
      if (!other.def.buffRange) continue;
      const d = Math.hypot(other.x - t.x, other.y - t.y);
      if (d <= other.def.buffRange) {
        dmg = t.def.damage * (1 + other.def.buffDamage);
      }
    }
    return dmg;
  }

  private fireProjectile(t: Tower, target: Monster, damage: number) {
    const p: Projectile = {
      id: this.nextProjId++,
      x: t.x,
      y: t.y,
      targetId: target.id,
      speed: t.def.projectileSpeed || 400,
      damage,
      splash: t.def.splash || 0,
      slowFactor: t.def.slowFactor || 0,
      slowDuration: t.def.slowDuration || 0,
      dot: t.def.dot || 0,
      dotDuration: t.def.dotDuration || 0,
      chain: t.def.chain || 0,
      hitIds: [],
      color: t.def.color,
      radius: t.def.splash ? 6 : 4,
      alive: true
    };
    this.projectiles.push(p);
    this.events.push({ type: 'projectile_fired', from: t, target });
  }

  private updateProjectiles(dt: number, now: number) {
    const toRemove: number[] = [];
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const target = this.monsters.find(m => m.id === p.targetId && m.alive);
      // 目标已死且无连锁，找新目标（连锁中）
      let tx: number, ty: number;
      if (target) {
        tx = target.x;
        ty = target.y;
      } else if (p.chain > 0 && p.hitIds.length < p.chain) {
        // 寻找最近未命中目标
        let best: Monster | null = null;
        let bestD = Infinity;
        for (const m of this.monsters) {
          if (!m.alive) continue;
          if (p.hitIds.includes(m.id)) continue;
          const d = Math.hypot(m.x - p.x, m.y - p.y);
          if (d < bestD && d < 200) {
            bestD = d;
            best = m;
          }
        }
        if (best) {
          p.targetId = best.id;
          tx = best.x;
          ty = best.y;
        } else {
          p.alive = false;
          toRemove.push(p.id);
          continue;
        }
      } else {
        p.alive = false;
        toRemove.push(p.id);
        continue;
      }

      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;

      if (dist <= step) {
        // 命中
        this.onProjectileHit(p, target!, now);
        p.alive = false;
        toRemove.push(p.id);
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      }
    }
    if (toRemove.length > 0) {
      this.projectiles = this.projectiles.filter(p => !toRemove.includes(p.id));
    }
  }

  private onProjectileHit(p: Projectile, primary: Monster, now: number) {
    const hitSet = new Set<number>([primary.id]);

    // 范围伤害
    if (p.splash > 0) {
      for (const m of this.monsters) {
        if (!m.alive) continue;
        if (m.id === primary.id) continue;
        if (Math.hypot(m.x - primary.x, m.y - primary.y) <= p.splash) {
          hitSet.add(m.id);
        }
      }
    }

    // 连锁
    if (p.chain > 0) {
      let chainCount = 0;
      let from = primary;
      while (chainCount < p.chain) {
        let best: Monster | null = null;
        let bestD = Infinity;
        for (const m of this.monsters) {
          if (!m.alive) continue;
          if (hitSet.has(m.id)) continue;
          const d = Math.hypot(m.x - from.x, m.y - from.y);
          if (d < 150 && d < bestD) {
            bestD = d;
            best = m;
          }
        }
        if (!best) break;
        hitSet.add(best.id);
        // 闪电光束
        this.beams.push({
          fromX: from.x, fromY: from.y,
          toX: best.x, toY: best.y,
          color: p.color, bornAt: now, ttl: 120
        });
        from = best;
        chainCount++;
      }
    }

    for (const id of hitSet) {
      const m = this.monsters.find(x => x.id === id);
      if (!m || !m.alive) continue;
      m.hp -= p.damage;
      if (p.slowFactor > 0) {
        m.slowUntil = now + p.slowDuration;
        m.slowFactor = p.slowFactor;
      }
      if (p.dot > 0) {
        m.dotEndAt = now + p.dotDuration;
        m.dotPerSec = p.dot;
      }
      if (m.hp <= 0) {
        this.killMonster(m, now);
      }
    }
  }

  private pushText(x: number, y: number, text: string, color: number) {
    this.floatingTexts.push({
      id: this.nextTextId++,
      x, y, text, color,
      bornAt: performance.now(),
      ttl: 900
    });
    if (this.floatingTexts.length > 60) {
      this.floatingTexts.shift();
    }
  }

  private updateFloatingTexts(now: number) {
    this.floatingTexts = this.floatingTexts.filter(t => now - t.bornAt < t.ttl);
  }

  private updateBeams(now: number) {
    this.beams = this.beams.filter(b => now - b.bornAt < b.ttl);
  }

  private checkWaveComplete() {
    if (!this.waveActive || this.waveEnded) return;
    if (this.spawnQueue.length === 0 && this.monstersAliveInWave <= 0) {
      this.waveEnded = true;
      this.waveActive = false;
      const reward = this.currentWave?.reward || 0;
      this.gold += reward;
      this.events.push({ type: 'wave_completed', wave: this.waveNum, reward });
      this.pushText(this.width / 2, this.height / 2, `波次 ${this.waveNum} 完成 +${reward}💰`, 0x2ecc71);
    }
  }

  // 消费事件
  consumeEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  reset() {
    this.gold = 80;
    this.score = 0;
    this.baseHp = this.maxBaseHp;
    this.monsters = [];
    this.towers = [];
    this.projectiles = [];
    this.floatingTexts = [];
    this.beams = [];
    this.inventory = [];
    this.waveNum = 0;
    this.currentWave = null;
    this.waveActive = false;
    this.spawnQueue = [];
    this.gameOver = false;
    this.paused = false;
    this.selectedTowerUid = null;
    this.selectedPlacedId = null;
    this.events = [];
  }
}
