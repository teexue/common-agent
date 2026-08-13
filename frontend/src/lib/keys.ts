/**
 * True while an IME composition is active — e.g. confirming a candidate with
 * Enter inside a Chinese input method. Enter during composition commits the
 * candidate text and must not trigger send / submit / next actions.
 *
 * `isComposing` is the standard flag; `keyCode === 229` covers legacy and
 * Safari quirks where composition keydowns report 229 instead.
 */
export function isComposingEvent(e: { nativeEvent: KeyboardEvent }): boolean {
  const ne = e.nativeEvent
  return ne.isComposing || ne.keyCode === 229
}
