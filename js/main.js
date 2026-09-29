import { Game } from './core/Game.js';

const game = new Game();
game.init();

if (game.geometryLabActive) {
  import('./ui/GeometryLab.js').then(({ GeometryLab }) => new GeometryLab(game).init());
}

export { game };
