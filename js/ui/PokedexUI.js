import { formatPoints } from '../utils/math.js';

export class PokedexUI {
  constructor(root = document) {
    this.list = root.querySelector('#character-list');
    this.detail = root.querySelector('#character-detail');
    this.count = root.querySelector('#prize-count');
    this.cards = new Map();
  }

  build(characters, onSelect) {
    this.list.replaceChildren();
    characters.forEach((character, index) => {
      const button = document.createElement('button');
      const image = document.createElement('img');
      const countText = document.createElement('span');
      const newBadge = document.createElement('span');
      button.className = 'character-card';
      button.type = 'button';
      button.setAttribute('aria-pressed', String(index === 0));
      image.src = encodeURI(character.path);
      image.alt = '';
      image.width = 30;
      image.height = 30;
      image.draggable = false;
      countText.className = 'character-catch-count';
      newBadge.className = 'character-new-badge';
      newBadge.textContent = 'NEW';
      newBadge.hidden = true;
      button.append(image, countText, newBadge);
      button.addEventListener('click', () => {
        this.list.querySelectorAll('.character-card').forEach((card) => card.setAttribute('aria-pressed', String(card === button)));
        onSelect(character);
      });
      this.list.append(button);
      this.cards.set(character.name, { button, image, countText, newBadge });
    });
  }

  render(characters, counts, selectedCharacter) {
    let caughtSpecies = 0;
    characters.forEach((character) => {
      const count = counts[character.name] || 0;
      const card = this.cards.get(character.name);
      if (count > 0) caughtSpecies += 1;
      if (!card) return;
      const locked = count === 0;
      card.button.classList.toggle('is-locked', locked);
      card.button.title = locked ? 'LOCKED · Gắp để mở khóa Pokémon' : `${character.name} · ${character.rarity.toUpperCase()} · ${formatPoints(character.score)} điểm · ${count} lần bắt`;
      card.button.setAttribute('aria-label', locked ? 'Pokémon chưa mở khóa. Gắp Pokémon để mở khóa.' : `${character.name}, ${character.rarity}, ${formatPoints(character.score)} điểm, đã bắt ${count} lần.`);
      card.image.classList.toggle('is-locked', locked);
      card.countText.textContent = locked ? 'LOCKED' : `×${count}`;
      card.newBadge.hidden = !character.newThisGame;
    });
    this.count.textContent = `${caughtSpecies} / ${characters.length} CAUGHT`;
    this.renderDetail(selectedCharacter, counts);
  }

  renderDetail(character, counts) {
    if (!character) return;
    const detail = document.createElement('span');
    const count = counts[character.name] || 0;
    if (count === 0) detail.textContent = 'LOCKED · Gắp Pokémon để mở khóa';
    else {
      detail.textContent = `${character.name} · ${character.rarity.toUpperCase()} · ${formatPoints(character.score)} điểm · Caught ${count} ${count === 1 ? 'time' : 'times'}`;
      detail.className = character.score < 0 ? 'is-penalty' : '';
    }
    this.detail.replaceChildren(detail);
  }
}
