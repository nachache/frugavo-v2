import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  CATEGORY_LIST,
  asCategory,
} from "@/lib/categories";

describe("category palette", () => {
  it("every category has a label and a color", () => {
    for (const cat of CATEGORY_LIST) {
      expect(CATEGORY_LABEL[cat]).toBeTruthy();
      expect(CATEGORY_COLOR[cat]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("asCategory falls back to 'other' for null + unknown", () => {
    expect(asCategory(null)).toBe("other");
    expect(asCategory(undefined)).toBe("other");
    expect(asCategory("not-a-real-category")).toBe("other");
  });

  it("asCategory passes through known categories", () => {
    expect(asCategory("streaming")).toBe("streaming");
    expect(asCategory("fitness")).toBe("fitness");
  });
});
