import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#2ecc71',
  scale: {
    mode: Phaser.Scale.FIT,
    width: 1200,
    height: 720,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-container'
  },
  render: {
    antialias: true,
    pixelArt: false
  },
  scene: [BootScene, PreloadScene, GameScene]
};

window.addEventListener('load', () => {
  new Phaser.Game(config);
});
