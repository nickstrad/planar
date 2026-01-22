const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: [
    "/node_modules/",
    ".*\\.integration\\.test\\.ts$",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/src/lib/inference/__tests__/setup.ts"],
  collectCoverageFrom: [
    "src/lib/inference/**/*.ts",
    "!src/lib/inference/__tests__/**",
  ],
  coverageDirectory: "coverage",
};

module.exports = createJestConfig(customJestConfig);
