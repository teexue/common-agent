import { describe, expect, it } from "vitest"
import { isComposingEvent } from "./keys"

function native(isComposing: boolean, keyCode: number): KeyboardEvent {
  return { isComposing, keyCode } as KeyboardEvent
}

describe("isComposingEvent", () => {
  it("returns true while an IME composition is active", () => {
    expect(isComposingEvent({ nativeEvent: native(true, 13) })).toBe(true)
  })

  it("returns true for the legacy IME keyCode 229", () => {
    expect(isComposingEvent({ nativeEvent: native(false, 229) })).toBe(true)
  })

  it("returns false for a plain Enter keypress", () => {
    expect(isComposingEvent({ nativeEvent: native(false, 13) })).toBe(false)
  })
})
