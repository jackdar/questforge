const POSITION_STORAGE_PREFIX = 'questforge.windowPosition.';

// A window must stay fully on the screen, so that the player can always reach its header again.
export function clampToScreen({ left, top }, { width, height }, { viewportWidth, viewportHeight }) {
  return {
    left: Math.min(Math.max(left, 0), Math.max(viewportWidth - width, 0)),
    top: Math.min(Math.max(top, 0), Math.max(viewportHeight - height, 0)),
  };
}

// The player drags the window by its handle. The window keeps its place across page loads.
export function makeDraggable(panel, handle, { storage, storageKey }) {
  let drag = null;

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const bounds = panel.getBoundingClientRect();
    drag = { offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove', (event) => {
    if (drag) moveTo({ left: event.clientX - drag.offsetX, top: event.clientY - drag.offsetY });
  });

  handle.addEventListener('pointerup', (event) => {
    if (!drag) return;
    drag = null;
    handle.releasePointerCapture(event.pointerId);
    savePosition();
  });

  window.addEventListener('resize', keepOnScreen);

  // A hidden window has no size, so call this again after the window opens.
  function keepOnScreen() {
    if (panel.style.left) moveTo({ left: panel.offsetLeft, top: panel.offsetTop });
  }

  function moveTo(position) {
    const { width, height } = panel.getBoundingClientRect();
    const viewport = { viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
    const { left, top } = clampToScreen(position, { width, height }, viewport);
    Object.assign(panel.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
  }

  function savePosition() {
    try {
      const position = { left: panel.offsetLeft, top: panel.offsetTop };
      storage.setItem(POSITION_STORAGE_PREFIX + storageKey, JSON.stringify(position));
    } catch (error) {
      console.warn(`Could not save the position of the ${storageKey} window. It resets when the page reloads.`, error);
    }
  }

  function restorePosition() {
    let saved;
    try {
      saved = JSON.parse(storage.getItem(POSITION_STORAGE_PREFIX + storageKey));
    } catch (error) {
      const message = `Could not read the saved position of the ${storageKey} window. It opens in its usual place.`;
      console.warn(message, error);
      return;
    }
    if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) moveTo(saved);
  }

  restorePosition();
  return { keepOnScreen };
}
