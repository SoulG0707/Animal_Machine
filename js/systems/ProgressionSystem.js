import { PROGRESSION_CONFIG, localDateKey } from '../config/progressionConfig.js';

export class ProgressionSystem {
  constructor(state, storage, eventBus, rewards, combo, config = PROGRESSION_CONFIG) {
    Object.assign(this, { state, storage, eventBus, rewards, combo, config });
    this.unsubscribe = [
      eventBus.on('pokemon:caught', (payload) => this.handleCatch(payload)),
      eventBus.on('pokemon:missed', () => this.handleMiss()),
      eventBus.on('pokemon:perfect', () => this.handlePerfect()),
      eventBus.on('pokemon:shinyCaught', () => this.handleShiny()),
      eventBus.on('mission:completed', ({ reward = 0, mission } = {}) => this.awardCoins(reward, 'daily-mission', { mission })),
      eventBus.on('daily:allCompleted', ({ reward = 0 } = {}) => this.awardCoins(reward, 'daily-bonus')),
      eventBus.on('achievement:unlocked', ({ achievement } = {}) => {
        if (achievement?.reward) this.awardCoins(achievement.reward, 'achievement', { achievement });
      }),
    ];
  }

  get coins() { return this.state.profile.coins; }

  save() { this.storage.savePlayerProfile(this.state.profile); }

  claimDailyLoginBonus(date = new Date()) {
    const dateKey = typeof date === 'string' ? date : localDateKey(date);
    if (this.state.profile.lastLoginBonusDate === dateKey) return false;
    this.state.profile.lastLoginBonusDate = dateKey;
    this.awardCoins(this.config.dailyLoginBonus, 'daily-login', { date: dateKey });
    this.save();
    this.eventBus.emit('daily:bonus', { coins: this.config.dailyLoginBonus, date: dateKey });
    return true;
  }

  recordPlay() {
    this.state.profile.stats.totalPlays += 1;
    this.save();
    this.eventBus.emit('player:progressChanged', { kind: 'play', total: this.state.profile.stats.totalPlays });
  }

  canAfford(cost = this.config.playCost) {
    return this.coins >= Math.max(0, Math.floor(Number(cost) || 0));
  }

  spendCoins(amount, source = 'play') {
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    if (!this.canAfford(cost)) return false;
    this.state.profile.coins -= cost;
    this.save();
    const payload = { amount: -cost, coins: this.coins, source };
    this.eventBus.emit('player:coinsChanged', payload);
    this.eventBus.emit('player:progressChanged', { kind: 'coins', total: this.coins });
    return true;
  }

  awardCoins(amount, source = 'reward', detail = {}) {
    const reward = Math.max(0, Math.floor(Number(amount) || 0));
    if (!reward) return 0;
    this.state.profile.coins += reward;
    this.state.profile.stats.totalCoinsEarned += reward;
    this.save();
    const payload = { amount: reward, coins: this.coins, source, ...detail };
    this.eventBus.emit('player:coinsChanged', payload);
    this.eventBus.emit('player:progressChanged', { kind: 'coins', total: this.coins });
    this.eventBus.emit('reward:coins', payload);
    return reward;
  }

  handleCatch({ pokemon, grab } = {}) {
    const stats = this.state.profile.stats;
    stats.totalCatches += 1;
    stats.highestCombo = Math.max(stats.highestCombo, this.state.currentCombo);
    let feverStarted = false;
    if (!this.state.fever.active && this.state.currentCombo >= this.config.feverThreshold) {
      this.state.fever.active = true;
      this.state.fever.remaining = this.config.feverDurationSeconds;
      feverStarted = true;
      this.eventBus.emit('combo:fever', {
        duration: this.config.feverDurationSeconds,
        multiplier: this.config.feverRewardMultiplier,
        combo: this.state.currentCombo,
      });
    }
    const character = pokemon?.character || {};
    const comboMultiplier = grab?.comboMultiplier || 1;
    const reward = this.rewards.calculateCatchReward({
      rarity: character.rarity,
      shiny: Boolean(pokemon?.shiny || pokemon?.variant === 'shiny'),
      comboMultiplier,
      fever: this.state.fever.active,
    });
    const payload = {
      ...reward,
      pokemon,
      name: character.name || pokemon?.name || 'Pokémon',
      rarity: character.rarity || 'common',
      shiny: Boolean(pokemon?.shiny || pokemon?.variant === 'shiny'),
      combo: this.state.currentCombo,
      fever: this.state.fever.active,
      feverStarted,
      source: 'catch',
    };
    this.awardCoins(reward.total, 'catch', payload);
    this.eventBus.emit('player:progressChanged', { kind: 'catch', total: stats.totalCatches });
  }

  handleMiss() {
    this.state.profile.stats.totalMisses += 1;
    this.combo.reset();
    this.save();
    this.eventBus.emit('player:progressChanged', { kind: 'miss', total: this.state.profile.stats.totalMisses });
  }

  handlePerfect() {
    this.state.profile.stats.totalPerfects += 1;
    this.save();
    this.eventBus.emit('player:progressChanged', { kind: 'perfect', total: this.state.profile.stats.totalPerfects });
  }

  handleShiny() {
    this.state.profile.stats.shinyCaught += 1;
    this.save();
    this.eventBus.emit('player:progressChanged', { kind: 'shiny', total: this.state.profile.stats.shinyCaught });
  }

  update(deltaSeconds) {
    if (!this.state.fever.active) return;
    this.state.fever.remaining = Math.max(0, this.state.fever.remaining - Math.max(0, deltaSeconds));
    if (this.state.fever.remaining > 0) return;
    this.state.fever.active = false;
    this.eventBus.emit('combo:feverEnded', {});
  }
}
