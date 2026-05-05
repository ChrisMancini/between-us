import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "!src/lib/**/__tests__/**",
    "!src/lib/models/**",
    "!src/lib/validations/**",
    "!src/lib/db.ts",
    "!src/lib/persons.ts",
    "!src/lib/app-settings.ts",
    "!src/lib/auth-providers.ts",
    "!src/lib/category-seed.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
