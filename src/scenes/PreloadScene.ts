import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }
  // 使用 Graphics API 绘制，无需外部素材
  preload() {
    // 空实现
  }
  create() {
    this.scene.start('Game');
  }
}
