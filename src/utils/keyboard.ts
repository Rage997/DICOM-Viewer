/**
 * Keyboard target guards shared by global and viewport-scoped shortcut handlers.
 *
 * Two guards, split by what the focused control natively consumes, so a shortcut
 * only bails when it would actually fight the control:
 *  - digit/character shortcuts bail on text-entry targets, but NOT on a range
 *    slider — a slider never consumes digit keys.
 *  - arrow shortcuts additionally bail on range sliders, which move on arrow
 *    keys, so a shortcut never double-drives them (e.g. the slice slider).
 */

// <input> types that consume typed characters, so digit/letter shortcuts yield.
const TEXT_INPUT_TYPE: Record<string, true> = {
  text: true,
  search: true,
  url: true,
  tel: true,
  email: true,
  password: true,
  number: true,
  date: true,
  'datetime-local': true,
  month: true,
  week: true,
  time: true,
};

/**
 * True when the event target is a text-entry control (text-like input, textarea,
 * select, or contenteditable). Character/digit shortcuts bail on these so typing
 * is never hijacked. A range slider is NOT a text-entry target.
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  // input.type is lowercased and defaults to 'text'.
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPE[target.type] === true;
  return false;
}

/**
 * True when the event target natively moves on arrow keys — every text-entry
 * control plus range sliders. Arrow shortcuts bail on these so they don't
 * double-act with the control's own arrow handling.
 */
export function isArrowKeyTarget(target: EventTarget | null): boolean {
  if (isTextEntryTarget(target)) return true;
  return target instanceof HTMLInputElement && target.type === 'range';
}
