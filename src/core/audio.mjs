// One resolver for audio capability (UX-003): Settings offers sound only when the
// player can actually create the same context.
export function audioContextClass(){return globalThis.AudioContext||globalThis.webkitAudioContext||null;}
export const audioAvailable=()=>typeof audioContextClass()==='function';
