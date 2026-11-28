// Observes the normal input path without driving it or waiting for app readiness.
(() => {
  const events = [];
  function describe(type, target) {
    const input = document.querySelector('.kp-answer');
    const view = document.querySelector('.app-view');
    return {
      type, ms: Math.round(performance.now()), route: location.hash,
      target: target?.getAttribute?.('data-part') || target?.tagName || null,
      active: document.activeElement?.className || document.activeElement?.tagName,
      online: navigator.onLine, controller: !!navigator.serviceWorker?.controller,
      disabled: input?.disabled, readOnly: input?.readOnly, inert: !!input?.closest('[inert]'),
      busy: view?.getAttribute('aria-busy'), feedback: !!document.querySelector('[data-answer-feedback]'),
      inputLength: input?.value.length
    };
  }
  for (const type of ['focusin', 'input', 'compositionstart', 'compositionend', 'keydown', 'keyup']) {
    document.addEventListener(type, event => {
      if (!location.hash.includes('/play') && !document.querySelector('.kp-answer')) return;
      if (event.key && event.key !== 'Enter') return;
      events.push({ ...describe(type, event.target), composing: event.isComposing ?? null,
        trusted: event.isTrusted, inputType: event.inputType ?? null, time: event.timeStamp });
      if (events.length > 32) events.shift();
    }, true);
  }
  window.__legacyObservation = () => ({ now: describe('snapshot', document.activeElement), events: events.slice() });
})();
