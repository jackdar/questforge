const FPS_SAMPLE_MS = 500;

export function createStatsDisplay() {
  const fpsElement = document.querySelector('#stats .fps');
  const pingElement = document.querySelector('#stats .ping');
  let framesInSample = 0;
  let sampleStartedAt = performance.now();

  function update(now, pingMs) {
    framesInSample++;
    const sampleDurationMs = now - sampleStartedAt;
    if (sampleDurationMs >= FPS_SAMPLE_MS) {
      fpsElement.textContent = `${Math.round((framesInSample * 1000) / sampleDurationMs)} FPS`;
      framesInSample = 0;
      sampleStartedAt = now;
    }

    pingElement.textContent = pingMs === null ? '– ms' : `${Math.round(pingMs)} ms`;
  }

  return { update };
}
