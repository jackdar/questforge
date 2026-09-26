// North is -z, so that east (+x) is on the right of the screen when the player faces north, as on a real compass.
// It is also the top of the map in the top view of Blender.
// A character with rotation 0 faces +z, which is south. Turning to rotation π/2 faces +x, which is east.
export function compassBearing(rotation) {
  const fullTurn = 2 * Math.PI;
  return (((Math.PI - rotation) % fullTurn) + fullTurn) % fullTurn;
}

// The dial turns so that the direction that the player faces is always at the top, under the pointer.
export function createCompass() {
  const compass = document.getElementById('compass');
  let shownDegrees = null;

  function update(rotation) {
    const degrees = Math.round((compassBearing(rotation) * 180) / Math.PI);
    if (degrees === shownDegrees) return;
    shownDegrees = degrees;
    compass.style.setProperty('--bearing', `${degrees}deg`);
    compass.title = `Facing ${degrees}°`;
  }

  function setVisible(isVisible) {
    compass.hidden = !isVisible;
  }

  return { update, setVisible };
}
