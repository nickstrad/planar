/**
 * Dummy test to verify Jest is configured correctly.
 * Delete this file once real tests are implemented.
 */

describe("Jest Setup", () => {
  it("should run a basic test", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle async tests", async () => {
    const result = await Promise.resolve("hello");
    expect(result).toBe("hello");
  });

  it("should support jest.fn() mocks", () => {
    const mockFn = jest.fn().mockReturnValue(42);
    expect(mockFn()).toBe(42);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should support path aliases", async () => {
    // This verifies that @/ alias is configured
    // Once types.ts exists, uncomment:
    // const types = await import("@/lib/inference/types");
    // expect(types).toBeDefined();
    expect(true).toBe(true);
  });
});
