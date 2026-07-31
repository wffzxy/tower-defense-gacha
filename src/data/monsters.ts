import type { MonsterDef } from '../types';

// 怪物配置：不同积分/血量/速度
export const MONSTERS: Record<string, MonsterDef> = {
  slime: {
    kind: 'slime',
    name: '史莱姆',
    hp: 40,
    speed: 60,
    score: 5,
    gold: 2,
    color: 0x7ed957,
    radius: 14,
    shape: 'circle'
  },
  goblin: {
    kind: 'goblin',
    name: '哥布林',
    hp: 60,
    speed: 110,
    score: 8,
    gold: 3,
    color: 0xff9f43,
    radius: 13,
    shape: 'triangle'
  },
  orc: {
    kind: 'orc',
    name: '兽人战士',
    hp: 200,
    speed: 50,
    score: 20,
    gold: 8,
    color: 0xc44569,
    radius: 18,
    shape: 'square'
  },
  wraith: {
    kind: 'wraith',
    name: '幽魂',
    hp: 120,
    speed: 90,
    score: 25,
    gold: 10,
    color: 0xa3a3ff,
    radius: 15,
    shape: 'diamond'
  },
  dragon: {
    kind: 'dragon',
    name: '飞龙',
    hp: 600,
    speed: 70,
    score: 50,
    gold: 25,
    color: 0xe84118,
    radius: 22,
    shape: 'triangle'
  },
  boss: {
    kind: 'boss',
    name: '魔王',
    hp: 3000,
    speed: 45,
    score: 200,
    gold: 100,
    color: 0x6c5ce7,
    radius: 30,
    shape: 'square'
  }
};
