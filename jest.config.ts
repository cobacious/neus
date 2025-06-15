// jest.config.ts
import type { JestConfigWithTsJest } from 'ts-jest';
import { resolve } from 'path';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: resolve(__dirname, 'tsconfig.json'),
        diagnostics: false,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  roots: ['<rootDir>/apps', '<rootDir>/packages'],
};

export default config;
