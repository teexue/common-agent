import { describe, expect, it } from "vitest"
import {
  stripHiddenPickerTools,
  visibleCatalogTools,
} from "@/lib/tool-visibility"

describe("tool visibility", () => {
  it("strips read_image from name lists", () => {
    expect(
      stripHiddenPickerTools(["read_file", "read_image", "get_time"])
    ).toEqual(["read_file", "get_time"])
  })

  it("hides read_image from catalog", () => {
    const tools = [
      { name: "read_file", description: "a" },
      { name: "read_image", description: "b" },
    ]
    expect(visibleCatalogTools(tools).map((t) => t.name)).toEqual(["read_file"])
  })
})
