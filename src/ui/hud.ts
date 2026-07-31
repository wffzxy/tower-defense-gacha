// DOM HUD 管理器：负责同步 GameSim 状态到 DOM，并转发按钮事件
// HUD 不持有游戏规则，只做展示 + 事件转发

import type { GameSim } from '../systems/GameSim';
import type { TowerDef } from '../types';

const RARITY_LABEL: Record<string, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说'
};

const RARITY_COLOR: Record<string, string> = {
  common: '#bdc3c7',
  rare: '#3498db',
  epic: '#9b59b6',
  legendary: '#f39c12'
};

const CATEGORY_LABEL: Record<string, string> = {
  fort: '城防',
  function: '功能',
  support: '辅助',
  mine: '金矿'
};

export interface HudCallbacks {
  onGacha: (pool: 'normal' | 'rare') => void;
  onStartWave: () => void;
  onPause: () => void;
  onSelectInventory: (uid: number | null) => void;
  onSelectPlaced: (id: number | null) => void;
  onSell: (id: number) => void;
  onRestart: () => void;
}

export class Hud {
  private sim: GameSim;
  private cb: HudCallbacks;

  private elGold: HTMLElement;
  private elScore: HTMLElement;
  private elWave: HTMLElement;
  private elBase: HTMLElement;
  private elInventory: HTMLElement;
  private elTowerInfo: HTMLElement;
  private elTiName: HTMLElement;
  private elTiType: HTMLElement;
  private elTiRarity: HTMLElement;
  private elTiDesc: HTMLElement;
  private elTiCost: HTMLElement;
  private elGachaModal: HTMLElement;
  private elGachaResult: HTMLElement;
  private elGameoverModal: HTMLElement;
  private elGameoverTitle: HTMLElement;
  private elGameoverSummary: HTMLElement;
  private elToast: HTMLElement;
  private elBtnNormal: HTMLButtonElement;
  private elBtnRare: HTMLButtonElement;
  private elBtnStartWave: HTMLButtonElement;
  private elBtnPause: HTMLButtonElement;
  private toastTimer: number | null = null;

  constructor(sim: GameSim, cb: HudCallbacks) {
    this.sim = sim;
    this.cb = cb;

    this.elGold = document.getElementById('stat-gold')!;
    this.elScore = document.getElementById('stat-score')!;
    this.elWave = document.getElementById('stat-wave')!;
    this.elBase = document.getElementById('stat-base')!;
    this.elInventory = document.getElementById('inventory')!;
    this.elTowerInfo = document.getElementById('tower-info')!;
    this.elTiName = document.getElementById('ti-name')!;
    this.elTiType = document.getElementById('ti-type')!;
    this.elTiRarity = document.getElementById('ti-rarity')!;
    this.elTiDesc = document.getElementById('ti-desc')!;
    this.elTiCost = document.getElementById('ti-cost')!;
    this.elGachaModal = document.getElementById('gacha-modal')!;
    this.elGachaResult = document.getElementById('gacha-result')!;
    this.elGameoverModal = document.getElementById('gameover-modal')!;
    this.elGameoverTitle = document.getElementById('gameover-title')!;
    this.elGameoverSummary = document.getElementById('gameover-summary')!;
    this.elToast = document.getElementById('toast')!;
    this.elBtnNormal = document.getElementById('btn-gacha-normal') as HTMLButtonElement;
    this.elBtnRare = document.getElementById('btn-gacha-rare') as HTMLButtonElement;
    this.elBtnStartWave = document.getElementById('btn-start-wave') as HTMLButtonElement;
    this.elBtnPause = document.getElementById('btn-pause') as HTMLButtonElement;

    this.bindEvents();
  }

  private bindEvents() {
    this.elBtnNormal.addEventListener('click', () => this.cb.onGacha('normal'));
    this.elBtnRare.addEventListener('click', () => this.cb.onGacha('rare'));
    this.elBtnStartWave.addEventListener('click', () => this.cb.onStartWave());
    this.elBtnPause.addEventListener('click', () => this.cb.onPause());
    document.getElementById('btn-close-gacha')!.addEventListener('click', () => {
      this.elGachaModal.classList.add('hidden');
    });
    document.getElementById('btn-sell')!.addEventListener('click', () => {
      if (this.sim.selectedPlacedId != null) {
        this.cb.onSell(this.sim.selectedPlacedId);
      }
    });
    document.getElementById('btn-restart')!.addEventListener('click', () => {
      this.elGameoverModal.classList.add('hidden');
      this.cb.onRestart();
    });
  }

  toast(msg: string, duration = 1800) {
    this.elToast.textContent = msg;
    this.elToast.classList.remove('hidden');
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.elToast.classList.add('hidden');
    }, duration);
  }

  showGachaResult(def: TowerDef | null) {
    if (!def) {
      this.toast('金币不足！');
      return;
    }
    const rarity = def.rarity;
    this.elGachaResult.innerHTML = `
      <div class="gacha-card rarity-${rarity}" style="border-color:${RARITY_COLOR[rarity]}">
        <div class="gc-color" style="background:#${def.color.toString(16).padStart(6, '0')}"></div>
        <div class="gc-name">${def.name}</div>
        <div class="gc-rarity" style="color:${RARITY_COLOR[rarity]}">${RARITY_LABEL[rarity]} · ${CATEGORY_LABEL[def.category]}</div>
        <div class="gc-desc">${def.description}</div>
        <div class="gc-cost">部署花费: ${def.cost}💰</div>
      </div>
      <p class="gacha-hint">已加入背包，点击背包中的塔再点击地图放置</p>
    `;
    this.elGachaModal.classList.remove('hidden');
  }

  showGameOver(reason: string) {
    this.elGameoverTitle.textContent = '游戏结束';
    this.elGameoverSummary.innerHTML = `
      <p>${reason}</p>
      <p>总积分: <b>${this.sim.score}</b></p>
      <p>通过波次: <b>${this.sim.waveNum - (this.sim.waveActive ? 1 : 0)}</b></p>
      <p>放置塔数: <b>${this.sim.towers.length}</b></p>
    `;
    this.elGameoverModal.classList.remove('hidden');
  }

  // 每帧同步状态
  update() {
    this.elGold.textContent = String(Math.floor(this.sim.gold));
    this.elScore.textContent = String(this.sim.score);
    this.elWave.textContent = String(this.sim.waveNum);
    this.elBase.textContent = `${this.sim.baseHp}/${this.sim.maxBaseHp}`;

    // 按钮可用性
    this.elBtnNormal.disabled = this.sim.gold < 10 || this.sim.gameOver;
    this.elBtnRare.disabled = this.sim.gold < 50 || this.sim.gameOver;
    this.elBtnStartWave.disabled = this.sim.waveActive || this.sim.gameOver;
    this.elBtnStartWave.textContent = this.sim.waveActive
      ? `进行中 (${this.sim.monstersAliveInWave})`
      : `下一波 (第${this.sim.waveNum + 1}波)`;
    this.elBtnPause.textContent = this.sim.paused ? '继续' : '暂停';

    this.renderInventory();
    this.renderTowerInfo();
  }

  private renderInventory() {
    const items = this.sim.inventory;
    if (items.length === 0) {
      this.elInventory.innerHTML = `<div class="inv-empty">点击「抽卡」获得塔，再点击背包中的塔放置到地图</div>`;
      return;
    }
    const html = items.map(item => {
      const def = item.def;
      const sel = this.sim.selectedTowerUid === item.uid ? 'selected' : '';
      const can = this.sim.gold >= def.cost;
      const color = `#${def.color.toString(16).padStart(6, '0')}`;
      return `
        <div class="inv-item rarity-${def.rarity} ${sel} ${can ? '' : 'disabled'}" data-uid="${item.uid}" title="${def.name} (${RARITY_LABEL[def.rarity]})">
          <div class="ii-color" style="background:${color}"></div>
          <div class="ii-name">${def.name}</div>
          <div class="ii-cost">${def.cost}💰</div>
        </div>
      `;
    }).join('');
    this.elInventory.innerHTML = html;
    // 绑定点击
    this.elInventory.querySelectorAll('.inv-item').forEach(el => {
      el.addEventListener('click', () => {
        const uid = Number(el.getAttribute('data-uid'));
        this.cb.onSelectInventory(this.sim.selectedTowerUid === uid ? null : uid);
      });
    });
  }

  private renderTowerInfo() {
    const placedId = this.sim.selectedPlacedId;
    if (placedId == null) {
      this.elTowerInfo.classList.add('hidden');
      return;
    }
    const t = this.sim.towers.find(x => x.id === placedId);
    if (!t) {
      this.elTowerInfo.classList.add('hidden');
      return;
    }
    const def = t.def;
    this.elTiName.textContent = def.name;
    this.elTiName.style.color = RARITY_COLOR[def.rarity];
    this.elTiType.textContent = `${CATEGORY_LABEL[def.category]} · ${RARITY_LABEL[def.rarity]}`;
    this.elTiRarity.textContent = RARITY_LABEL[def.rarity];
    this.elTiDesc.textContent = def.description;
    this.elTiCost.textContent = `${def.cost}💰 (返还 ${Math.floor(def.cost * 0.5)}💰)`;
    this.elTowerInfo.classList.remove('hidden');
  }

  // 取消所有选择
  clearSelection() {
    this.sim.selectedTowerUid = null;
    this.sim.selectedPlacedId = null;
  }
}
