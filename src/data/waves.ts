import type { WaveDef } from '../types';

// 波次配置：递增难度，每5波一个boss
export const WAVES: WaveDef[] = [
  { wave: 1, reward: 10, spawns: [
    { kind: 'slime', count: 8, interval: 800, delay: 0 }
  ]},
  { wave: 2, reward: 12, spawns: [
    { kind: 'slime', count: 10, interval: 700, delay: 0 },
    { kind: 'goblin', count: 4, interval: 600, delay: 4000 }
  ]},
  { wave: 3, reward: 15, spawns: [
    { kind: 'goblin', count: 12, interval: 500, delay: 0 }
  ]},
  { wave: 4, reward: 18, spawns: [
    { kind: 'slime', count: 8, interval: 400, delay: 0 },
    { kind: 'orc', count: 3, interval: 1500, delay: 3000 }
  ]},
  { wave: 5, reward: 30, spawns: [
    { kind: 'goblin', count: 10, interval: 400, delay: 0 },
    { kind: 'orc', count: 4, interval: 1200, delay: 2000 },
    { kind: 'boss', count: 1, interval: 1000, delay: 8000 }
  ]},
  { wave: 6, reward: 25, spawns: [
    { kind: 'wraith', count: 12, interval: 500, delay: 0 }
  ]},
  { wave: 7, reward: 28, spawns: [
    { kind: 'orc', count: 6, interval: 900, delay: 0 },
    { kind: 'wraith', count: 8, interval: 600, delay: 3000 }
  ]},
  { wave: 8, reward: 35, spawns: [
    { kind: 'slime', count: 20, interval: 250, delay: 0 },
    { kind: 'dragon', count: 1, interval: 1000, delay: 5000 }
  ]},
  { wave: 9, reward: 40, spawns: [
    { kind: 'wraith', count: 15, interval: 400, delay: 0 },
    { kind: 'orc', count: 6, interval: 800, delay: 2000 }
  ]},
  { wave: 10, reward: 80, spawns: [
    { kind: 'dragon', count: 2, interval: 3000, delay: 0 },
    { kind: 'orc', count: 8, interval: 600, delay: 1000 },
    { kind: 'boss', count: 1, interval: 1000, delay: 10000 }
  ]},
  { wave: 11, reward: 50, spawns: [
    { kind: 'dragon', count: 3, interval: 2500, delay: 0 },
    { kind: 'wraith', count: 12, interval: 400, delay: 2000 }
  ]},
  { wave: 12, reward: 100, spawns: [
    { kind: 'dragon', count: 4, interval: 2000, delay: 0 },
    { kind: 'boss', count: 2, interval: 5000, delay: 8000 }
  ]}
];

// 无限模式：超出后按比例生成
export function getWave(waveNum: number): WaveDef {
  if (waveNum <= WAVES.length) return WAVES[waveNum - 1];
  // 自适应难度
  const scale = 1 + (waveNum - WAVES.length) * 0.3;
  return {
    wave: waveNum,
    reward: 50 + (waveNum - WAVES.length) * 10,
    spawns: [
      { kind: 'orc', count: Math.floor(5 * scale), interval: 700, delay: 0 },
      { kind: 'wraith', count: Math.floor(8 * scale), interval: 400, delay: 2000 },
      { kind: 'dragon', count: Math.floor(2 * scale), interval: 2500, delay: 5000 },
      { kind: 'boss', count: Math.floor(scale), interval: 5000, delay: 10000 }
    ]
  };
}
