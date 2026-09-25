export function createGameMenu({ onLogOut }) {
  const overlay = document.getElementById('game-menu');

  overlay.querySelector('[data-action="return-to-game"]').addEventListener('click', close);
  overlay.querySelector('[data-action="log-out"]').addEventListener('click', () => {
    close();
    onLogOut();
  });

  function open() {
    overlay.hidden = false;
  }

  function close() {
    overlay.hidden = true;
  }

  return { open, close, isOpen: () => !overlay.hidden };
}
