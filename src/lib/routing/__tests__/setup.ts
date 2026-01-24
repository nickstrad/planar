// Jest setup file for routing tests

import { resetRoutingConfig } from "../config";
import { clearAllPolicies } from "../policy";

// Reset state between tests
beforeEach(() => {
  jest.clearAllMocks();
  resetRoutingConfig();
  clearAllPolicies();
});

// Global test timeout (10 seconds)
jest.setTimeout(10_000);
