export class BackConfirmModal {
  constructor(root = document) {
    this.overlay = root.querySelector('#back-confirm-modal');
    this.stayButton = root.querySelector('#back-stay-btn');
    this.leaveButton = root.querySelector('#back-leave-btn');
  }

  bind({ onStay, onLeave }) {
    this.stayButton.addEventListener('click', onStay);
    this.leaveButton.addEventListener('click', onLeave);
    this.overlay.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onStay();
    });
  }

  show() {
    this.overlay.hidden = false;
    this.overlay.setAttribute('aria-hidden', 'false');
    this.stayButton.focus({ preventScroll: true });
  }

  hide() {
    this.overlay.hidden = true;
    this.overlay.setAttribute('aria-hidden', 'true');
  }
}
