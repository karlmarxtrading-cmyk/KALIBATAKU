// The document remembers physical key lifetimes across route changes. Only the
// currently mounted arena/result can own a command; keyup never issues one.
let owner;
const held = new Map();
let composing = false, justComposed = false, compositionTimer, committedTarget;
const enter = event => event.key === 'Enter' || event.code === 'NumpadEnter';
const keyId = event => event.code || 'Enter';
function block(event) { event.preventDefault(); event.stopImmediatePropagation(); }
export function mountEnter(signal, accepts, dispatch) {
  if(signal?.aborted)return;
  const current = {accepts, dispatch};
  owner = current;
  signal?.addEventListener('abort', () => { if (owner === current) owner = null; }, {once:true});
}
export function initializeEnter() {
  document.addEventListener('compositionstart', () => {composing = true; committedTarget = null;}, true);
  document.addEventListener('compositionend', () => {
    composing = false; justComposed = true; committedTarget = null; clearTimeout(compositionTimer);
    compositionTimer = setTimeout(() => {justComposed = false; committedTarget = null;}, 0);
  }, true);
  document.addEventListener('input', event => {
    // Firefox can deliver a distinct physical Enter immediately after committing
    // text while the same-task implicit submit guard is still active.
    if (justComposed && !event.isComposing) committedTarget = event.target;
  }, true);
  document.addEventListener('keydown', event => {
    if (!enter(event)) return;
    const id = keyId(event), previous = held.get(id);
    if (previous !== undefined || event.repeat) {
      if (previous || owner?.accepts(event.target)) block(event);
      return;
    }
    const takes = !!owner?.accepts(event.target);
    held.set(id, takes);
    if (!takes) return;
    if (composing || (justComposed && event.target !== committedTarget) || event.isComposing || event.keyCode === 229) {
      // Let the IME accept its candidate; the form submit guard covers this key.
      return;
    }
    block(event);
    // Modified Enter on an owned input must also suppress native form submission.
    if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) owner.dispatch();
  }, true);
  document.addEventListener('keyup', event => {
    if (!enter(event)) return;
    const id = keyId(event), taken = held.get(id);
    held.delete(id);
    if (taken && !event.isComposing && !composing) block(event);
  }, true);
  const reset = () => {held.clear(); composing = false; justComposed = false; committedTarget = null;};
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => {if (document.hidden) reset();});
}
export function compositionActive() { return composing || justComposed; }
