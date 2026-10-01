import { describe, expect, it } from "vitest";
import { createServerFn } from "@tanstack/react-start";

describe("TanStack Start server API", () => {
  it("exposes the server function factory used by the application", () => {
    expect(createServerFn).toEqual(expect.any(Function));
  });
});
