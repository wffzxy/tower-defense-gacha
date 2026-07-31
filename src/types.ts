// 全局类型定义

export type TowerCategory = 'fort' | 'function' | 'support' | 'mine';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type MonsterKind = string;

export interface MonsterDef {
  kind: string;
  name: string;
  hp: number;
  speed: number;       // 像素/秒
  score: number;       // 杀死获得的积分
  gold: number;        // 杀死获得的金币
  color: number;       // 0xRRGGBB
  radius: number;      // 视觉半径
  shape?: 'circle' | 'square' | 'triangle' | 'diamond';
}

export interface TowerDef {
  id: string;
  name: string;
  category: TowerCategory;
  rarity: Rarity;
  cost: number;            // 部署所需金币
  description: string;
  color: number;
  // 战斗属性 (城防/功能)
  range?: number;          // 攻击范围
  damage?: number;         // 伤害
  fireRate?: number;       // 每秒攻击次数
  projectileSpeed?: number;
  splash?: number;         // 范围伤害半径 (0=单体)
  slowFactor?: number;     // 减速比例 (0-1)
  slowDuration?: number;   // 减速持续秒
  dot?: number;            // 持续伤害/秒
  dotDuration?: number;
  chain?: number;          // 连锁目标数
  // 辅助
  buffRange?: number;
  buffDamage?: number;     // 增伤比例 (0.2 = +20%)
  buffRangeBonus?: number; // 增加射程比例
  // 金矿
  goldPerTick?: number;
  tickInterval?: number;   // 秒
  scoreBonus?: number;     // 击杀额外积分比例
}

export interface Monster {
  id: number;
  def: MonsterDef;
  hp: number;
  maxHp: number;
  pathIndex: number;       // 当前 waypoint 索引
  x: number;
  y: number;
  slowUntil: number;       // 减速结束时间戳 (ms)
  slowFactor: number;
  dotEndAt: number;
  dotPerSec: number;
  alive: boolean;
}

export interface Tower {
  id: number;
  def: TowerDef;
  x: number;
  y: number;
  lastFireAt: number;      // ms
  lastTickAt: number;      // ms (金矿)
  targetId: number | null;
  cooldownMs: number;
}

export interface WaveSpawn {
  kind: string;
  count: number;
  interval: number;        // 出生间隔 ms
  delay: number;           // 起始延迟 ms
}

export interface WaveDef {
  wave: number;
  spawns: WaveSpawn[];
  reward: number;          // 完成奖励
}

export interface InventoryItem {
  uid: number;
  def: TowerDef;
}
