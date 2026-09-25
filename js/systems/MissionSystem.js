export class MissionSystem {
  constructor(state, characters) {
    this.state = state;
    this.characters = characters;
  }

  start() {
    const missionType = Math.floor(Math.random() * 3);
    if (missionType === 0) {
      const targets = this.characters.filter((character) => character.score > 0);
      const target = targets[Math.floor(Math.random() * targets.length)];
      this.state.mission = { type: 'species', target: target.name, goal: 1, progress: 0, completed: false, copy: `Catch ${target.name}` };
    } else if (missionType === 1) {
      this.state.mission = { type: 'count', target: 3, goal: 3, progress: 0, completed: false, copy: 'Catch 3 Pokémon' };
    } else {
      this.state.mission = { type: 'score', target: 150, goal: 150, progress: 0, completed: false, copy: 'Earn 150 points' };
    }
    this.updateProgress();
    return this.state.mission;
  }

  updateProgress() {
    const mission = this.state.mission;
    if (!mission) return null;
    if (mission.type === 'species') mission.progress = this.state.sessionCaughtSpecies.has(mission.target) ? 1 : 0;
    if (mission.type === 'count') mission.progress = this.state.caughtThisGame;
    if (mission.type === 'score') mission.progress = Math.max(0, this.state.score);
    return mission;
  }

  checkCompletion() {
    const mission = this.updateProgress();
    if (!mission || mission.completed || mission.progress < mission.goal) return false;
    mission.completed = true;
    this.state.turns += 1;
    return true;
  }
}
