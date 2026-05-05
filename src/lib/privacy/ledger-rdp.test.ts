import { describe, expect, it } from "vitest";

import {
  resolveRenyiCompositionAlpha,
  resolveRenyiCompositionAlphaWithPending,
} from "@/lib/privacy/ledger-rdp";

describe("resolveRenyiCompositionAlpha", () => {
  it("uses policy α on an empty ledger", () => {
    expect(resolveRenyiCompositionAlpha([], 9)).toEqual({
      compositionAlpha: 9,
      renyiHomogeneous: true,
    });
  });

  it("uses ledger α when every row agrees", () => {
    const rows = [{ renyiOrder: 7 }, { renyiOrder: 7 }];
    expect(resolveRenyiCompositionAlpha(rows, 3)).toEqual({
      compositionAlpha: 7,
      renyiHomogeneous: true,
    });
  });

  it("falls back to policy α when orders disagree", () => {
    const rows = [{ renyiOrder: 4 }, { renyiOrder: 9 }];
    expect(resolveRenyiCompositionAlpha(rows, 8)).toEqual({
      compositionAlpha: 8,
      renyiHomogeneous: false,
    });
  });
});

describe("resolveRenyiCompositionAlphaWithPending", () => {
  it("detects heterogeneity introduced by the pending order", () => {
    const rows = [{ renyiOrder: 7 }, { renyiOrder: 7 }];
    expect(resolveRenyiCompositionAlphaWithPending(rows, 9, 8)).toEqual({
      compositionAlpha: 8,
      renyiHomogeneous: false,
    });
  });

  it("stays homogeneous when pending matches the ledger anchor", () => {
    const rows = [{ renyiOrder: 7 }];
    expect(resolveRenyiCompositionAlphaWithPending(rows, 7, 99)).toEqual({
      compositionAlpha: 7,
      renyiHomogeneous: true,
    });
  });
});
