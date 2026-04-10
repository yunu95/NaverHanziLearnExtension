const path = require("path");
const { defineConfig } = require("@playwright/test");

const edgeExecutable =
  process.env.EDGE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

module.exports = defineConfig({
  testDir: path.join(__dirname, "tests"),
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    headless: false,
    viewport: { width: 1280, height: 900 },
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "edge-extension",
      use: {
        browserName: "chromium",
        channel: "msedge",
        launchOptions: {
          executablePath: edgeExecutable,
        },
      },
    },
  ],
});
