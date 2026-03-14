const { createDefaultPreset } = require("ts-jest");

const preset = createDefaultPreset();
const tsCfg = preset.transform?.["^.+\\.tsx?$"]?.[1] || {};
module.exports = {
  roots: ["<rootDir>/src/__tests__"],
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        ...tsCfg,
        diagnostics: { ignoreCodes: [1343, 151002] },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^uuid$": "<rootDir>/src/__mocks__/uuid.ts",
  },
};
