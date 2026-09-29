import { PROGRESSION_CONFIG } from '../config/progressionConfig.js';

const STAT_LABELS = Object.freeze([
  ['totalPlays', 'TOTAL PLAYS'],
  ['totalCatches', 'TOTAL CATCHES'],
  ['totalMisses', 'TOTAL MISSES'],
  ['totalPerfects', 'PERFECT GRABS'],
  ['highestCombo', 'HIGHEST COMBO'],
  ['totalCoinsEarned', 'COINS EARNED'],
  ['shinyCaught', 'SHINY CAUGHT'],
]);

function element(tag, className, text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function rarityClass(rarity) {
  return `rarity-${String(rarity || 'common').toLowerCase()}`;
}

export class ProgressionPanel {
  constructor(root = document) {
    this.root = root;
    this.overlay = root.querySelector('#profile-modal');
    this.dialog = this.overlay.querySelector('.progression-dialog');
    this.closeButton = root.querySelector('#close-profile-btn');
    this.tabs = [...this.overlay.querySelectorAll('[data-profile-tab]')];
    this.panels = [...this.overlay.querySelectorAll('[data-profile-panel]')];
    this.coins = root.querySelector('#profile-coins');
    this.dailyDate = root.querySelector('#daily-date');
    this.dailyList = root.querySelector('#daily-mission-list');
    this.dailyBonusNote = root.querySelector('#daily-bonus-note');
    this.achievementCount = root.querySelector('#achievement-count');
    this.achievementList = root.querySelector('#achievement-list');
    this.pokedexCount = root.querySelector('#profile-pokedex-count');
    this.pokedexList = root.querySelector('#profile-pokedex-list');
    this.profileLevel = root.querySelector('#profile-level');
    this.statsGrid = root.querySelector('#player-stats-grid');
    this.toastRegion = root.querySelector('#progression-toasts');
    this.returnFocus = null;
    this.toastQueue = [];
    this.activeToast = null;
    this.toastTimer = null;
    this.toastRemovalTimer = null;
  }

  bind({ onOpen = () => {}, onClose = () => {} } = {}) {
    this.onClose = onClose;
    this.root.querySelectorAll('[data-open-profile]').forEach((button) => {
      button.addEventListener('click', () => onOpen(button.dataset.openProfile || 'daily', button));
    });
    this.closeButton.addEventListener('click', () => this.close());
    this.tabs.forEach((tab) => tab.addEventListener('click', () => this.selectTab(tab.dataset.profileTab)));
    this.overlay.addEventListener('pointerdown', (event) => {
      if (event.target === this.overlay) this.close();
    });
    this.overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); this.close(); }
      if (event.key !== 'Tab') return;
      const focusable = [...this.dialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }

  open(tab = 'daily', opener = document.activeElement) {
    this.clearToasts();
    this.returnFocus = opener;
    this.overlay.hidden = false;
    this.overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('profile-open');
    this.selectTab(tab);
    this.closeButton.focus({ preventScroll: true });
  }

  close() {
    this.overlay.hidden = true;
    this.overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('profile-open');
    this.returnFocus?.focus?.({ preventScroll: true });
    this.onClose?.();
  }

  selectTab(name) {
    const selected = this.tabs.some((tab) => tab.dataset.profileTab === name) ? name : 'daily';
    this.tabs.forEach((tab) => {
      const active = tab.dataset.profileTab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    this.panels.forEach((panel) => {
      const active = panel.dataset.profilePanel === selected;
      panel.hidden = !active;
      panel.setAttribute('aria-hidden', String(!active));
    });
  }

  render({ profile, missions, achievements, characters, level = 1 }) {
    this.coins.textContent = String(profile.coins);
    this.renderDailyMissions(profile, missions);
    this.renderAchievements(achievements);
    this.renderPokedex(profile, characters);
    this.renderStats(profile, level);
  }

  renderDailyMissions(profile, missions) {
    const daily = profile.dailyMissions;
    this.dailyDate.textContent = daily.date || '';
    this.dailyList.replaceChildren();
    missions.forEach((mission, index) => {
      const card = element('article', `daily-mission-item${mission.completed ? ' is-complete' : ''}`);
      const header = element('div', 'progress-item-header');
      header.append(element('strong', '', mission.copy));
      header.append(element('span', 'progress-reward', `+${mission.reward} COINS`));
      const row = element('div', 'progress-item-row');
      row.append(element('span', '', `${mission.progress} / ${mission.goal}`));
      row.append(element('span', 'progress-item-state', mission.completed ? 'COMPLETE' : 'IN PROGRESS'));
      const track = element('div', 'progress-track');
      const fill = element('span', '');
      fill.style.width = `${Math.round(mission.progress / mission.goal * 100)}%`;
      track.append(fill);
      card.append(header, row, track);
      card.style.setProperty('--mission-order', String(index));
      this.dailyList.append(card);
    });
    const allComplete = missions.length > 0 && missions.every((mission) => mission.completed);
    const dailyBonusClaimed = profile.lastLoginBonusDate === daily.date;
    this.dailyBonusNote.textContent = allComplete
      ? `ALL COMPLETE · +${PROGRESSION_CONFIG.dailyMissionCompletionBonus} COIN BONUS`
      : dailyBonusClaimed
        ? `DAILY BONUS CLAIMED · +${PROGRESSION_CONFIG.dailyLoginBonus} COINS`
        : `DAILY LOGIN BONUS · +${PROGRESSION_CONFIG.dailyLoginBonus} COINS`;
    this.dailyBonusNote.classList.toggle('is-complete', allComplete);
  }

  renderAchievements(achievements) {
    const unlockedCount = achievements.filter((item) => item.unlocked).length;
    this.achievementCount.textContent = `${unlockedCount} / ${achievements.length} UNLOCKED`;
    this.achievementList.replaceChildren();
    achievements.forEach((achievement) => {
      const card = element('article', `achievement-item${achievement.unlocked ? ' is-unlocked' : ''}`);
      const icon = element('span', 'achievement-icon', achievement.unlocked ? '★' : '◇');
      icon.setAttribute('aria-hidden', 'true');
      const content = element('div', 'achievement-copy');
      content.append(element('strong', '', achievement.name));
      content.append(element('span', '', achievement.description));
      const reward = element('span', 'progress-reward', `+${achievement.reward}`);
      const progress = element('span', 'achievement-progress', achievement.unlocked
        ? 'UNLOCKED'
        : `${this.formatProgress(achievement.progress)} / ${achievement.goal}`);
      card.append(icon, content, reward, progress);
      this.achievementList.append(card);
    });
  }

  formatProgress(value) {
    return Number.isInteger(value) ? String(value) : `${Math.min(100, Math.floor(value * 100))}%`;
  }

  renderPokedex(profile, characters) {
    const entries = profile.collection;
    const discovered = Object.values(entries).filter((entry) => entry.discovered).length;
    this.pokedexCount.textContent = `${discovered} / ${characters.length} DISCOVERED`;
    this.pokedexList.replaceChildren();
    characters.forEach((character) => {
      const entry = entries[character.name] || { discovered: false, caughtCount: 0, shinyCaughtCount: 0, bestGrabQuality: 0 };
      const card = element('article', `profile-pokedex-card ${rarityClass(character.rarity)}${entry.discovered ? '' : ' is-locked'}`);
      const image = element('img', 'profile-pokemon-image');
      image.src = encodeURI(character.path);
      image.alt = entry.discovered ? character.name : 'Undiscovered Pokémon';
      image.width = 48;
      image.height = 48;
      image.draggable = false;
      const detail = element('div', 'profile-pokemon-copy');
      detail.append(element('strong', '', entry.discovered ? character.name.toUpperCase() : '???'));
      detail.append(element('span', `rarity-badge ${rarityClass(character.rarity)}`,
        entry.discovered ? character.rarity.toUpperCase() : 'UNKNOWN'));
      detail.append(element('span', 'profile-catch-count', entry.discovered ? `CAUGHT ×${entry.caughtCount}` : 'NOT DISCOVERED'));
      const variants = element('div', 'profile-variants');
      const normalCount = Math.max(0, entry.caughtCount - entry.shinyCaughtCount);
      variants.append(element('span', normalCount ? 'variant-found' : '', `NORMAL ${normalCount ? `✓ ×${normalCount}` : '?'}`));
      variants.append(element('span', entry.shinyCaughtCount ? 'variant-shiny' : '', `SHINY ${entry.shinyCaughtCount ? `✦ ×${entry.shinyCaughtCount}` : '?'}`));
      card.append(image, detail, variants);
      this.pokedexList.append(card);
    });
  }

  renderStats(profile, level) {
    this.profileLevel.textContent = `LV ${level}`;
    this.statsGrid.replaceChildren();
    STAT_LABELS.forEach(([key, label]) => {
      const item = element('div', 'player-stat-item');
      item.append(element('span', '', label));
      item.append(element('strong', '', String(profile.stats[key] || 0)));
      this.statsGrid.append(item);
    });
  }

  bindEvents(eventBus) {
    eventBus.on('reward:coins', (payload) => this.showReward(payload));
    eventBus.on('combo:fever', ({ duration }) => this.showToast(`FEVER MODE · ${duration}s`, 'fever'));
  }

  showReward(payload) {
    const amount = Number(payload.amount) || 0;
    const coinText = `${amount >= 0 ? '+' : ''}${amount} COINS`;
    let text = coinText;
    let tone = 'reward';
    if (payload.source === 'catch') {
      const rarity = String(payload.rarity || 'common').toUpperCase();
      text = `${payload.shiny ? 'SHINY! · ' : ''}${payload.name} · ${rarity} · ${coinText}`;
      tone = payload.shiny ? 'shiny' : payload.rarity || 'reward';
    } else if (payload.source === 'daily-mission') {
      text = `DAILY MISSION COMPLETE · ${coinText}`;
      tone = 'bonus';
    } else if (payload.source === 'daily-bonus') {
      text = `ALL DAILY MISSIONS · ${coinText}`;
      tone = 'bonus';
    } else if (payload.source === 'daily-login') {
      text = `DAILY BONUS · ${coinText}`;
      tone = 'bonus';
    } else if (payload.source === 'achievement') {
      text = `${payload.achievement?.name || 'ACHIEVEMENT'} · ${coinText}`;
      tone = 'achievement';
    }
    this.showToast(text, tone, { priority: payload.source === 'catch' });
  }

  showToast(text, tone = 'reward', { priority = false } = {}) {
    if (!this.overlay.hidden) return;
    if (priority) {
      if (this.activeToast) {
        this.toastQueue.unshift({ text: this.activeToast.textContent, tone: this.activeToast.dataset.tone || 'reward' });
        this.activeToast.remove();
        window.clearTimeout(this.toastTimer);
        window.clearTimeout(this.toastRemovalTimer);
        this.activeToast = null;
      }
      this.toastQueue.unshift({ text, tone });
      this.toastQueue = this.toastQueue.slice(0, 3);
    } else {
      this.toastQueue.push({ text, tone });
      if (this.toastQueue.length > 2) this.toastQueue.shift();
    }
    this.showNextToast();
  }

  showNextToast() {
    if (this.activeToast || !this.toastQueue.length || !this.overlay.hidden) return;
    const { text, tone } = this.toastQueue.shift();
    const toast = element('div', `progression-toast tone-${tone}`, text);
    toast.dataset.tone = tone;
    toast.setAttribute('role', 'status');
    this.toastRegion.append(toast);
    this.activeToast = toast;
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    this.toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      this.toastRemovalTimer = window.setTimeout(() => {
        toast.remove();
        this.activeToast = null;
        this.toastTimer = null;
        this.toastRemovalTimer = null;
        this.showNextToast();
      }, 180);
    }, 1500);
  }

  clearToasts() {
    window.clearTimeout(this.toastTimer);
    window.clearTimeout(this.toastRemovalTimer);
    this.toastQueue = [];
    this.activeToast = null;
    this.toastTimer = null;
    this.toastRemovalTimer = null;
    this.toastRegion.replaceChildren();
  }
}
