import Phaser from 'phaser';
import { GameSim, type Projectile } from '../systems/GameSim';
import { Hud } from '../ui/hud';
import type { Monster, Tower } from '../types';

const WORLD_W = 1200;
const WORLD_H = 720;

export class GameScene extends Phaser.Scene {
  sim!: GameSim;
  hud!: Hud;

  private bgGfx!: Phaser.GameObjects.Graphics;
  private fxGfx!: Phaser.GameObjects.Graphics;
  private rangeGfx!: Phaser.GameObjects.Graphics;
  private placementGfx!: Phaser.GameObjects.Graphics;
  private bgTexts: Phaser.GameObjects.Text[] = [];

  private pointerText!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  create() {
    this.sim = new GameSim(WORLD_W, WORLD_H);

    // FIT 模式：固定 1200x720 世界，自动缩放到 #game-container
    this.cameras.main.setBackgroundColor('#2ecc71');

    // 图层
    this.bgGfx = this.add.graphics();
    this.rangeGfx = this.add.graphics();
    this.placementGfx = this.add.graphics();
    this.fxGfx = this.add.graphics();

    this.drawBackground();

    this.pointerText = this.add.text(0, 0, '', {
      fontSize: '11px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 4, y: 2 }
    }).setDepth(1000).setVisible(false);

    this.hud = new Hud(this.sim, {
      onGacha: (pool) => this.handleGacha(pool),
      onStartWave: () => this.handleStartWave(),
      onPause: () => { this.sim.paused = !this.sim.paused; },
      onSelectInventory: (uid) => {
        this.sim.selectFromInventory(uid);
        this.sim.selectedPlacedId = null;
      },
      onSelectPlaced: (id) => {
        this.sim.selectPlaced(id);
      },
      onSell: (id) => {
        this.sim.sellTower(id);
      },
      onRestart: () => {
        this.sim.reset();
        this.drawBackground();
      }
    });

    // 输入：点击放置/选中
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.updatePlacementPreview(pointer);
    });

    // 启动提示
    this.hud.toast('点击「抽卡」获得塔 → 选中背包塔 → 点击地图放置 → 开始波次', 4000);
  }

  // ============ 背景：超平坦空地 + S 形路径 ============
  private drawBackground() {
    const g = this.bgGfx;
    g.clear();
    // 清理旧文字
    for (const t of this.bgTexts) t.destroy();
    this.bgTexts = [];

    // 超平坦绿色草地，带网格
    g.fillStyle(0x2ecc71, 1);
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // 浅色棋盘格纹
    g.fillStyle(0x27ae60, 0.25);
    const tile = 40;
    for (let y = 0; y < WORLD_H; y += tile) {
      for (let x = 0; x < WORLD_W; x += tile) {
        if (((x / tile) + (y / tile)) % 2 === 0) {
          g.fillRect(x, y, tile, tile);
        }
      }
    }

    // 路径阴影（更宽的深色）
    const path = this.sim.path.waypoints;
    g.lineStyle(this.sim.path.pathWidth * 2 + 8, 0x6e5848, 0.6);
    g.beginPath();
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      g.lineTo(path[i].x, path[i].y);
    }
    g.strokePath();

    // 路径主体（土色）
    g.lineStyle(this.sim.path.pathWidth * 2, 0xd2a679, 1);
    g.beginPath();
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      g.lineTo(path[i].x, path[i].y);
    }
    g.strokePath();

    // 路径中线虚线
    g.lineStyle(2, 0xb98860, 0.6);
    g.beginPath();
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      g.lineTo(path[i].x, path[i].y);
    }
    g.strokePath();

    // 入口标识（怪物出生点）
    const sp = path[0];
    g.fillStyle(0xe74c3c, 0.5);
    g.fillCircle(sp.x + 30, sp.y, 24);
    g.lineStyle(3, 0xc0392b, 1);
    g.strokeCircle(sp.x + 30, sp.y, 24);
    g.fillStyle(0xffffff, 1);
    const txtIn = this.add.text(sp.x + 30, sp.y, '入', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5).setDepth(5);
    this.bgTexts.push(txtIn);

    // 基地（终点）
    const bp = this.sim.path.basePoint;
    g.fillStyle(0x34495e, 1);
    g.fillRect(bp.x - 50, bp.y - 50, 40, 100);
    g.fillStyle(0xe74c3c, 1);
    g.fillTriangle(bp.x - 30, bp.y - 50, bp.x - 30, bp.y - 80, bp.x, bp.y - 60);
    g.fillStyle(0xecf0f1, 1);
    g.fillRect(bp.x - 44, bp.y - 20, 12, 12);
    g.fillRect(bp.x - 28, bp.y - 20, 12, 12);
    const txtBase = this.add.text(bp.x - 30, bp.y + 60, '基地', { fontSize: '14px', color: '#ffffff', backgroundColor: '#00000088' }).setOrigin(0.5).setDepth(5);
    this.bgTexts.push(txtBase);
  }

  // ============ 输入处理 ============
  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (this.sim.gameOver) return;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // 若背包有选中塔，尝试放置
    if (this.sim.selectedTowerUid != null) {
      const ok = this.sim.placeTower(this.sim.selectedTowerUid, wp.x, wp.y);
      if (!ok) {
        this.hud.toast('无法放置：位置无效或金币不足');
      }
      return;
    }

    // 否则尝试选中已放置塔
    let clicked: Tower | null = null;
    for (const t of this.sim.towers) {
      if (Math.hypot(t.x - wp.x, t.y - wp.y) < 22) {
        clicked = t;
        break;
      }
    }
    if (clicked) {
      this.sim.selectPlaced(clicked.id);
    } else {
      this.sim.selectPlaced(null);
    }
  }

  private updatePlacementPreview(pointer: Phaser.Input.Pointer) {
    if (this.sim.selectedTowerUid == null) {
      this.placementGfx.clear();
      this.pointerText.setVisible(false);
      return;
    }
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const item = this.sim.inventory.find(i => i.uid === this.sim.selectedTowerUid);
    if (!item) {
      this.placementGfx.clear();
      this.pointerText.setVisible(false);
      return;
    }
    const def = item.def;
    const can = this.sim.canPlaceAt(wp.x, wp.y) && this.sim.gold >= def.cost;
    const g = this.placementGfx;
    g.clear();
    // 范围圈
    if (def.range) {
      g.lineStyle(2, can ? 0x2ecc71 : 0xe74c3c, 0.5);
      g.strokeCircle(wp.x, wp.y, def.range);
      g.fillStyle(can ? 0x2ecc71 : 0xe74c3c, 0.08);
      g.fillCircle(wp.x, wp.y, def.range);
    }
    // 塔预览
    g.lineStyle(2, can ? 0xffffff : 0xe74c3c, 0.9);
    g.fillStyle(def.color, 0.7);
    g.fillCircle(wp.x, wp.y, 18);
    g.strokeCircle(wp.x, wp.y, 18);

    // 显示花费
    this.pointerText.setText(`${def.name} ${def.cost}💰 ${can ? '' : '✗'}`);
    this.pointerText.setPosition(wp.x + 22, wp.y - 10);
    this.pointerText.setVisible(true);
  }

  // ============ HUD 事件 ============
  private handleGacha(pool: 'normal' | 'rare') {
    const def = this.sim.gacha(pool);
    this.hud.showGachaResult(def);
  }

  private handleStartWave() {
    if (this.sim.waveActive) return;
    if (this.sim.startNextWave()) {
      this.hud.toast(`第 ${this.sim.waveNum} 波开始！`);
    }
  }

  // ============ 主循环 ============
  update(time: number, delta: number) {
    if (!this.sim) return;
    this.sim.update(delta, time);
    this.consumeEvents();

    this.renderRange();
    this.renderWorld(time);
    this.hud.update();
  }

  private consumeEvents() {
    const events = this.sim.consumeEvents();
    for (const e of events) {
      switch (e.type) {
        case 'wave_started':
          break;
        case 'wave_completed':
          this.hud.toast(`第 ${e.wave} 波完成，奖励 ${e.reward} 金币`);
          break;
        case 'game_over':
          this.hud.showGameOver(e.reason);
          break;
      }
    }
  }

  // ============ 范围指示器（选中塔时显示） ============
  private renderRange() {
    const g = this.rangeGfx;
    g.clear();
    if (this.sim.selectedPlacedId != null) {
      const t = this.sim.towers.find(x => x.id === this.sim.selectedPlacedId);
      if (t) {
        const range = (t.def.category === 'fort' || t.def.category === 'function')
          ? this.sim.effRange(t)
          : (t.def.buffRange || 0);
        if (range > 0) {
          g.lineStyle(2, 0xfeca57, 0.6);
          g.strokeCircle(t.x, t.y, range);
          g.fillStyle(0xfeca57, 0.06);
          g.fillCircle(t.x, t.y, range);
        }
        // 选中圈
        g.lineStyle(3, 0xfeca57, 0.9);
        g.strokeCircle(t.x, t.y, 24);
      }
    }
  }

  // ============ 世界渲染 ============
  private renderWorld(now: number) {
    const g = this.fxGfx;
    g.clear();

    // 塔
    for (const t of this.sim.towers) {
      this.drawTower(g, t, now);
    }

    // 怪物
    for (const m of this.sim.monsters) {
      if (!m.alive) continue;
      this.drawMonster(g, m, now);
    }

    // 投射物
    for (const p of this.sim.projectiles) {
      if (!p.alive) continue;
      this.drawProjectile(g, p);
    }

    // 雷电光束
    for (const b of this.sim.beams) {
      const alpha = Math.max(0, 1 - (now - b.bornAt) / b.ttl);
      g.lineStyle(3, b.color, alpha);
      g.beginPath();
      g.moveTo(b.fromX, b.fromY);
      g.lineTo(b.toX, b.toY);
      g.strokePath();
      g.lineStyle(1, 0xffffff, alpha * 0.7);
      g.beginPath();
      g.moveTo(b.fromX, b.fromY);
      g.lineTo(b.toX, b.toY);
      g.strokePath();
    }

    // 浮动文字
    for (const ft of this.sim.floatingTexts) {
      const age = now - ft.bornAt;
      const alpha = Math.max(0, 1 - age / ft.ttl);
      const offsetY = -(age / ft.ttl) * 30;
      const colorHex = '#' + ft.color.toString(16).padStart(6, '0');
      // 用 Phaser Text 性能差，这里改用 graphics 描边文字模拟
      // 直接用 add.text 会创建大量对象，所以用 graphics 绘制简化版本
      g.fillStyle(ft.color, alpha);
      // 文字用简单的矩形 + 文本对象太重，这里我们用一个临时 text 池
      // 实际上 Phaser Graphics 不支持文本，所以浮动文字用独立 Text 对象
    }
    this.renderFloatingTexts(now);
  }

  // 浮动文字用独立 Text 池
  private textPool: Phaser.GameObjects.Text[] = [];
  private renderFloatingTexts(now: number) {
    const texts = this.sim.floatingTexts;
    // 扩展池
    while (this.textPool.length < texts.length) {
      const t = this.add.text(0, 0, '', {
        fontSize: '14px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold'
      }).setDepth(500).setOrigin(0.5);
      this.textPool.push(t);
    }
    // 隐藏多余
    for (let i = texts.length; i < this.textPool.length; i++) {
      this.textPool[i].setVisible(false);
    }
    // 更新
    for (let i = 0; i < texts.length; i++) {
      const ft = texts[i];
      const txt = this.textPool[i];
      const age = now - ft.bornAt;
      const alpha = Math.max(0, 1 - age / ft.ttl);
      const offsetY = -(age / ft.ttl) * 30;
      const colorHex = '#' + ft.color.toString(16).padStart(6, '0');
      txt.setText(ft.text);
      txt.setColor(colorHex);
      txt.setAlpha(alpha);
      txt.setPosition(ft.x, ft.y + offsetY);
      txt.setVisible(true);
    }
  }

  // ============ 塔绘制 ============
  private drawTower(g: Phaser.GameObjects.Graphics, t: Tower, now: number) {
    const x = t.x;
    const y = t.y;
    const color = t.def.color;

    // 阴影
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(x + 2, y + 4, 36, 18);

    // 底座
    g.fillStyle(0x34495e, 1);
    g.fillRoundedRect(x - 16, y - 16, 32, 32, 6);
    g.lineStyle(2, 0x2c3e50, 1);
    g.strokeRoundedRect(x - 16, y - 16, 32, 32, 6);

    // 类别图标
    if (t.def.category === 'mine') {
      // 金矿：金币堆
      g.fillStyle(color, 1);
      g.fillCircle(x - 6, y + 2, 7);
      g.fillCircle(x + 6, y + 2, 7);
      g.fillCircle(x, y - 4, 7);
      g.lineStyle(2, 0xf39c12, 1);
      g.strokeCircle(x - 6, y + 2, 7);
      g.strokeCircle(x + 6, y + 2, 7);
      g.strokeCircle(x, y - 4, 7);
      // 闪烁
      const blink = (Math.sin(now / 200) + 1) / 2;
      g.fillStyle(0xffffff, blink * 0.5);
      g.fillCircle(x, y - 4, 2);
    } else if (t.def.category === 'support') {
      // 辅助：光环
      g.lineStyle(3, color, 0.7);
      g.strokeCircle(x, y, 14);
      g.fillStyle(color, 0.5);
      g.fillCircle(x, y, 6);
      // 旋转标记
      const ang = now / 500;
      for (let i = 0; i < 3; i++) {
        const a = ang + (i * Math.PI * 2) / 3;
        const px = x + Math.cos(a) * 14;
        const py = y + Math.sin(a) * 14;
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(px, py, 2.5);
      }
    } else {
      // 城防/功能：炮塔
      g.fillStyle(color, 1);
      g.fillCircle(x, y, 12);
      g.lineStyle(2, 0x000000, 0.4);
      g.strokeCircle(x, y, 12);

      // 炮管朝向目标
      let barrelAngle = -Math.PI / 2;
      if (t.targetId != null) {
        const target = this.sim.monsters.find(m => m.id === t.targetId && m.alive);
        if (target) {
          barrelAngle = Math.atan2(target.y - y, target.x - x);
        }
      }
      const barrelLen = 16;
      const bx = x + Math.cos(barrelAngle) * barrelLen;
      const by = y + Math.sin(barrelAngle) * barrelLen;
      g.lineStyle(5, 0x2c3e50, 1);
      g.lineBetween(x, y, bx, by);
      g.lineStyle(2, color, 1);
      g.lineBetween(x, y, bx, by);

      // 开火闪光
      if (t.targetId != null && now - t.lastFireAt < 80) {
        g.fillStyle(0xffff00, 0.9);
        g.fillCircle(bx, by, 6);
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(bx, by, 3);
      }
    }

    // 稀有度标记环
    const rarityColor = {
      common: 0xbdc3c7,
      rare: 0x3498db,
      epic: 0x9b59b6,
      legendary: 0xf39c12
    }[t.def.rarity];
    g.lineStyle(2, rarityColor, 0.8);
    g.strokeRoundedRect(x - 16, y - 16, 32, 32, 6);
  }

  // ============ 怪物绘制 ============
  private drawMonster(g: Phaser.GameObjects.Graphics, m: Monster, now: number) {
    const x = m.x;
    const y = m.y;
    const def = m.def;

    // 阴影
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(x + 2, y + def.radius + 2, def.radius * 1.8, def.radius * 0.6);

    // 主体
    g.fillStyle(def.color, 1);
    g.lineStyle(2, 0x000000, 0.4);

    switch (def.shape) {
      case 'circle':
        g.fillCircle(x, y, def.radius);
        g.strokeCircle(x, y, def.radius);
        break;
      case 'square':
        g.fillRect(x - def.radius, y - def.radius, def.radius * 2, def.radius * 2);
        g.strokeRect(x - def.radius, y - def.radius, def.radius * 2, def.radius * 2);
        break;
      case 'triangle':
        g.fillTriangle(
          x, y - def.radius,
          x - def.radius, y + def.radius,
          x + def.radius, y + def.radius
        );
        g.strokeTriangle(
          x, y - def.radius,
          x - def.radius, y + def.radius,
          x + def.radius, y + def.radius
        );
        break;
      case 'diamond':
        g.fillTriangle(
          x, y - def.radius,
          x + def.radius, y,
          x, y + def.radius,
          x - def.radius, y
        );
        g.strokeTriangle(
          x, y - def.radius,
          x + def.radius, y,
          x, y + def.radius,
          x - def.radius, y
        );
        break;
    }

    // 眼睛
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(x - def.radius * 0.3, y - def.radius * 0.1, def.radius * 0.18);
    g.fillCircle(x + def.radius * 0.3, y - def.radius * 0.1, def.radius * 0.18);
    g.fillStyle(0x000000, 1);
    g.fillCircle(x - def.radius * 0.3, y - def.radius * 0.1, def.radius * 0.08);
    g.fillCircle(x + def.radius * 0.3, y - def.radius * 0.1, def.radius * 0.08);

    // 减速冰冻效果
    if (now < m.slowUntil) {
      g.lineStyle(2, 0x74b9ff, 0.6);
      g.strokeCircle(x, y, def.radius + 3);
      g.fillStyle(0x74b9ff, 0.15);
      g.fillCircle(x, y, def.radius + 3);
    }
    // 中毒效果
    if (now < m.dotEndAt) {
      g.fillStyle(0x55efc4, 0.4);
      g.fillCircle(x - def.radius * 0.4, y - def.radius * 0.4, 3);
      g.fillCircle(x + def.radius * 0.3, y + def.radius * 0.3, 3);
    }

    // 血条
    if (m.hp < m.maxHp) {
      const barW = Math.max(28, def.radius * 2);
      const barH = 4;
      const bx = x - barW / 2;
      const by = y - def.radius - 10;
      g.fillStyle(0x000000, 0.7);
      g.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
      g.fillStyle(0xc0392b, 1);
      g.fillRect(bx, by, barW, barH);
      const hpRatio = Math.max(0, m.hp / m.maxHp);
      g.fillStyle(hpRatio > 0.5 ? 0x2ecc71 : (hpRatio > 0.25 ? 0xf1c40f : 0xe67e22), 1);
      g.fillRect(bx, by, barW * hpRatio, barH);
    }
  }

  // ============ 投射物绘制 ============
  private drawProjectile(g: Phaser.GameObjects.Graphics, p: Projectile) {
    // 拖尾
    g.fillStyle(p.color, 0.3);
    g.fillCircle(p.x, p.y, p.radius * 1.8);
    // 主体
    g.fillStyle(p.color, 1);
    g.fillCircle(p.x, p.y, p.radius);
    g.lineStyle(1, 0xffffff, 0.8);
    g.strokeCircle(p.x, p.y, p.radius);
    // 高光
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.3);
  }
}
