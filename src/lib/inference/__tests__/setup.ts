// Jest setup file for inference tests

// Mock server-only module for tests
jest.mock("server-only", () => ({}));

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test timeout (10 seconds)
jest.setTimeout(10_000);
