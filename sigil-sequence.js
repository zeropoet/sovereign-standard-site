(() => {
  async function loadSequenceUnits(root) {
    const manifestPath = root.dataset.sequenceManifest || 'units.json';
    const response = await fetch(manifestPath, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Unable to load ${manifestPath}`);
    }

    const manifest = await response.json();

    if (!Array.isArray(manifest.units) || manifest.units.length === 0) {
      throw new Error('No units available');
    }

    const units = manifest.units
      .map((record) => {
        if (typeof record === 'number') {
          return record;
        }

        const unitID = Number(record?.id ?? record?.unit);
        return Number.isFinite(unitID) ? unitID : null;
      })
      .filter((unitID) => unitID !== null);

    if (units.length === 0) {
      throw new Error('No sequence units available');
    }

    return units;
  }

  async function initSigilSequence(root) {
    const image = root.querySelector('[data-sequence-image]');

    if (!image) {
      return;
    }

    const units = await loadSequenceUnits(root);
    const mode = root.dataset.sequenceMode || 'display';
    const speedControl = root.querySelector('[data-sequence-speed]');
    const speedValue = root.querySelector('[data-sequence-speed-value]');
    const frameControl = root.querySelector('[data-sequence-frame]');
    const frameLabel = root.querySelector('[data-sequence-label]');
    const togglePlay = root.querySelector('[data-sequence-toggle]');
    const stepPrev = root.querySelector('[data-sequence-prev]');
    const stepNext = root.querySelector('[data-sequence-next]');

    let frameIndex = Math.min(Number(root.dataset.sequenceStart || 0), units.length - 1);
    let isPlaying = root.dataset.sequenceAutoplay !== 'false';
    let lastTick = performance.now();
    let animationFrameId = 0;

    const getFps = () => {
      if (speedControl) {
        return Number(speedControl.value);
      }

      return Number(root.dataset.sequenceFps || 8);
    };

    const setPlaying = (nextState) => {
      isPlaying = nextState;

      if (togglePlay) {
        togglePlay.textContent = isPlaying ? 'Pause' : 'Play';
      }
    };

    const updateFrame = () => {
      const unit = units[frameIndex];
      image.src = `output/${unit}/sigil.svg`;
      image.alt = `Sigil for unit ${unit}`;

      if (frameControl) {
        frameControl.value = String(frameIndex);
      }

      if (frameLabel) {
        frameLabel.textContent = `Unit ${unit} / ${units.length}`;
      }
    };

    const stepFrame = (direction) => {
      frameIndex = (frameIndex + direction + units.length) % units.length;
      updateFrame();
    };

    const handleKeydown = (event) => {
      if (mode !== 'player') {
        return;
      }

      if (event.key === ' ') {
        event.preventDefault();
        setPlaying(!isPlaying);
        lastTick = performance.now();
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPlaying(false);
        stepFrame(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPlaying(false);
        stepFrame(1);
      }
    };

    const tick = (now) => {
      const fps = getFps();
      const interval = 1000 / fps;

      if (isPlaying && now - lastTick >= interval) {
        const steps = Math.floor((now - lastTick) / interval);
        frameIndex = (frameIndex + steps) % units.length;
        updateFrame();
        lastTick += steps * interval;
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    if (frameControl) {
      frameControl.max = String(units.length - 1);
      frameControl.addEventListener('input', () => {
        setPlaying(false);
        frameIndex = Number(frameControl.value);
        updateFrame();
      });
    }

    if (speedControl) {
      speedControl.addEventListener('input', () => {
        if (speedValue) {
          speedValue.textContent = `${speedControl.value} fps`;
        }

        lastTick = performance.now();
      });

      if (speedValue) {
        speedValue.textContent = `${speedControl.value} fps`;
      }
    }

    if (togglePlay) {
      togglePlay.addEventListener('click', () => {
        setPlaying(!isPlaying);
        lastTick = performance.now();
      });
    }

    if (stepPrev) {
      stepPrev.addEventListener('click', () => {
        setPlaying(false);
        stepFrame(-1);
      });
    }

    if (stepNext) {
      stepNext.addEventListener('click', () => {
        setPlaying(false);
        stepFrame(1);
      });
    }

    document.addEventListener('keydown', handleKeydown);

    updateFrame();
    setPlaying(isPlaying);
    animationFrameId = requestAnimationFrame(tick);

    root.cleanupSigilSequence = () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('keydown', handleKeydown);
    };
  }

  document.querySelectorAll('[data-sigil-sequence]').forEach((root) => {
    initSigilSequence(root).catch(() => {
      const frameLabel = root.querySelector('[data-sequence-label]');

      if (frameLabel) {
        frameLabel.textContent = 'Unable to load units.';
      }
    });
  });
})();
