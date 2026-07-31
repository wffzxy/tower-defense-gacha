import type { TowerDef } from '../types';

// 塔配置：城防(攻击) / 功能(控制) / 辅助(增益) / 金矿(经济)
export const TOWERS: TowerDef[] = [
  // ========== 城防类 (fort) - 直接伤害 ==========
  {
    id: 'arrow_tower',
    name: '箭塔',
    category: 'fort',
    rarity: 'common',
    cost: 15,
    description: '单体远程攻击，攻速快，基础城防。',
    color: 0x4a90e2,
    range: 140,
    damage: 12,
    fireRate: 2.0,
    projectileSpeed: 400
  },
  {
    id: 'cannon_tower',
    name: '炮塔',
    category: 'fort',
    rarity: 'rare',
    cost: 35,
    description: '范围爆炸伤害，攻速慢但威力大。',
    color: 0xd4a373,
    range: 120,
    damage: 35,
    fireRate: 0.7,
    projectileSpeed: 280,
    splash: 50
  },
  {
    id: 'mage_tower',
    name: '魔法塔',
    category: 'fort',
    rarity: 'rare',
    cost: 45,
    description: '魔法穿透攻击，无视减速抗性。',
    color: 0xb388ff,
    range: 160,
    damage: 28,
    fireRate: 1.2,
    projectileSpeed: 500
  },
  {
    id: 'sniper_tower',
    name: '狙击塔',
    category: 'fort',
    rarity: 'epic',
    cost: 80,
    description: '超远射程，高额单体爆发。',
    color: 0x00b894,
    range: 280,
    damage: 120,
    fireRate: 0.5,
    projectileSpeed: 800
  },

  // ========== 功能类 (function) - 控制/特殊 ==========
  {
    id: 'frost_tower',
    name: '冰霜塔',
    category: 'function',
    rarity: 'common',
    cost: 20,
    description: '减速命中怪物，使其移动变慢。',
    color: 0x74b9ff,
    range: 130,
    damage: 6,
    fireRate: 1.5,
    projectileSpeed: 350,
    slowFactor: 0.5,
    slowDuration: 2000
  },
  {
    id: 'poison_tower',
    name: '毒塔',
    category: 'function',
    rarity: 'rare',
    cost: 40,
    description: '施加持续中毒伤害。',
    color: 0x55efc4,
    range: 140,
    damage: 8,
    fireRate: 1.0,
    projectileSpeed: 350,
    dot: 12,
    dotDuration: 3000
  },
  {
    id: 'tesla_tower',
    name: '雷电塔',
    category: 'function',
    rarity: 'epic',
    cost: 75,
    description: '雷电连锁攻击多个目标。',
    color: 0xfdcb6e,
    range: 150,
    damage: 25,
    fireRate: 1.0,
    projectileSpeed: 800,
    chain: 3
  },

  // ========== 辅助类 (support) - 增益 ==========
  {
    id: 'drum_tower',
    name: '战鼓塔',
    category: 'support',
    rarity: 'rare',
    cost: 50,
    description: '提升范围内友方塔的伤害 +25%。',
    color: 0xe17055,
    range: 0,
    damage: 0,
    buffRange: 110,
    buffDamage: 0.25
  },
  {
    id: 'beacon_tower',
    name: '灯塔',
    category: 'support',
    rarity: 'epic',
    cost: 70,
    description: '增加范围内友方塔射程 +30%。',
    color: 0xffeaa7,
    range: 0,
    damage: 0,
    buffRange: 120,
    buffRangeBonus: 0.3
  },

  // ========== 金矿类 (mine) - 经济 ==========
  {
    id: 'gold_mine',
    name: '金矿',
    category: 'mine',
    rarity: 'common',
    cost: 25,
    description: '每 5 秒产出 5 金币。',
    color: 0xf1c40f,
    range: 0,
    damage: 0,
    goldPerTick: 5,
    tickInterval: 5000
  },
  {
    id: 'rich_mine',
    name: '富矿',
    category: 'mine',
    rarity: 'rare',
    cost: 60,
    description: '每 6 秒产出 15 金币。',
    color: 0xf39c12,
    range: 0,
    damage: 0,
    goldPerTick: 15,
    tickInterval: 6000
  },
  {
    id: 'soul_mine',
    name: '魂矿',
    category: 'mine',
    rarity: 'epic',
    cost: 90,
    description: '每 7 秒产出 10 金币，并使击杀额外获得 +20% 积分。',
    color: 0x9b59b6,
    range: 0,
    damage: 0,
    goldPerTick: 10,
    tickInterval: 7000,
    scoreBonus: 0.2
  }
];

export const TOWER_MAP: Record<string, TowerDef> = Object.fromEntries(
  TOWERS.map(t => [t.id, t])
);

// 抽卡池（按稀有度权重）
export const GACHA_POOL: Record<string, { def: TowerDef; weight: number }[]> = {
  // 普通抽卡：偏向普通
  normal: [
    { def: TOWER_MAP['arrow_tower'], weight: 35 },
    { def: TOWER_MAP['frost_tower'], weight: 25 },
    { def: TOWER_MAP['gold_mine'], weight: 25 },
    { def: TOWER_MAP['cannon_tower'], weight: 8 },
    { def: TOWER_MAP['poison_tower'], weight: 5 },
    { def: TOWER_MAP['mage_tower'], weight: 2 }
  ],
  // 高级抽卡：偏向稀有以上
  rare: [
    { def: TOWER_MAP['cannon_tower'], weight: 25 },
    { def: TOWER_MAP['mage_tower'], weight: 20 },
    { def: TOWER_MAP['poison_tower'], weight: 15 },
    { def: TOWER_MAP['drum_tower'], weight: 12 },
    { def: TOWER_MAP['rich_mine'], weight: 10 },
    { def: TOWER_MAP['sniper_tower'], weight: 8 },
    { def: TOWER_MAP['tesla_tower'], weight: 6 },
    { def: TOWER_MAP['beacon_tower'], weight: 3 },
    { def: TOWER_MAP['soul_mine'], weight: 1 }
  ]
};
