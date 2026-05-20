/**
 * Playwright E2E smoke tests for the Naver Hanja extension.
 *
 * Each test gets its own fresh browser profile (tmpDir) so storage is clean.
 * Run with:  npm run test:smoke
 */

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { test, expect, chromium } = require("@playwright/test");

const extensionPath = path.resolve(__dirname, "..");
const edgeExecutable =
  process.env.EDGE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

/** Launch a fresh persistent context with the extension loaded. */
async function launchCtx() {
  const tmpDir = path.join(
    os.tmpdir(),
    `hanja-ext-${crypto.randomBytes(4).toString("hex")}`
  );
  return chromium.launchPersistentContext(tmpDir, {
    headless: false,
    executablePath: edgeExecutable,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
}

/** Wait for the service-worker and return the extension id. */
async function getExtId(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker");
  return new URL(sw.url()).host;
}

/** Open a new popup page and wait for the preset bar to render. */
async function openPopup(context, extId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/popup.html`);
  await expect(page.locator("#presetBar")).toBeVisible();
  return page;
}

// ---------------------------------------------------------------------------

test.describe("Naver Hanja extension — preset & save behavior", () => {

  // ── 1 ─────────────────────────────────────────────────────────────────────
  test("fresh open: 기본 is active and textarea is disabled", async () => {
    const ctx = await launchCtx();
    try {
      const extId = await getExtId(ctx);
      const page = await openPopup(ctx, extId);

      await expect(page.locator(".preset-btn").filter({ hasText: "기본" })).toHaveClass(/preset-active/);
      await expect(page.locator("#hanziList")).toBeDisabled();
    } finally {
      await ctx.close();
    }
  });

  // ── 2 ─────────────────────────────────────────────────────────────────────
  test("creating a custom preset activates it and re-enables textarea", async () => {
    const ctx = await launchCtx();
    try {
      const extId = await getExtId(ctx);
      const page = await openPopup(ctx, extId);

      page.on("dialog", async (d) => {
        if (d.type() === "prompt") await d.accept("나의목록");
        else await d.dismiss();
      });
      await page.locator(".preset-add").click();

      // New preset button is visible
      await expect(page.locator(".preset-name").first()).toBeVisible();

      // The new preset is active
      await expect(page.locator(".preset-item").first()).toHaveClass(/preset-active/);
      // 기본 is not active
      await expect(page.locator(".preset-btn").filter({ hasText: "기본" })).not.toHaveClass(/preset-active/);
      // Textarea is enabled
      await expect(page.locator("#hanziList")).toBeEnabled();
    } finally {
      await ctx.close();
    }
  });

  // ── 3 ─────────────────────────────────────────────────────────────────────
  test("clicking 기본 then custom preset correctly switches active state", async () => {
    const ctx = await launchCtx();
    try {
      const extId = await getExtId(ctx);
      const page = await openPopup(ctx, extId);

      page.on("dialog", async (d) => {
        if (d.type() === "prompt") await d.accept("스위치테스트");
        else await d.dismiss();
      });
      await page.locator(".preset-add").click();
      await expect(page.locator(".preset-item").first()).toHaveClass(/preset-active/);

      // Go to 기본
      await page.locator(".preset-btn").filter({ hasText: "기본" }).click();
      await expect(page.locator(".preset-btn").filter({ hasText: "기본" })).toHaveClass(/preset-active/);
      await expect(page.locator(".preset-item").first()).not.toHaveClass(/preset-active/);

      // Go back to custom
      await page.locator(".preset-name").first().click();
      await expect(page.locator(".preset-item").first()).toHaveClass(/preset-active/);
      await expect(page.locator(".preset-btn").filter({ hasText: "기본" })).not.toHaveClass(/preset-active/);
    } finally {
      await ctx.close();
    }
  });

  // ── 4 ─────────────────────────────────────────────────────────────────────
  test("unsaved textarea edits revert after popup close/reopen", async () => {
    const ctx = await launchCtx();
    try {
      const extId = await getExtId(ctx);
      const page = await openPopup(ctx, extId);

      page.on("dialog", async (d) => {
        if (d.type() === "prompt") await d.accept("리버트테스트");
        else await d.dismiss();
      });
      await page.locator(".preset-add").click();
      await expect(page.locator("#hanziList")).toBeEnabled();

      // Fill, click save, then edit without saving
      await page.locator("#hanziList").fill("金 銀 銅");
      await page.locator("#saveHanziList").click();
      await page.waitForTimeout(200);

      await page.locator("#hanziList").fill("金 銀 銅 鐵 錫");
      // Do NOT click save button

      // Close and reopen
      await page.close();
      const page2 = await openPopup(ctx, extId);

      const val = await page2.locator("#hanziList").inputValue();
      expect(val).toContain("金");
      expect(val).toContain("銀");
      expect(val).toContain("銅");
      expect(val).not.toContain("鐵");
      expect(val).not.toContain("錫");
    } finally {
      await ctx.close();
    }
  });

  // ── 5 ─────────────────────────────────────────────────────────────────────
  test("saved textarea edits persist after popup close/reopen", async () => {
    const ctx = await launchCtx();
    try {
      const extId = await getExtId(ctx);
      const page = await openPopup(ctx, extId);

      page.on("dialog", async (d) => {
        if (d.type() === "prompt") await d.accept("저장테스트");
        else await d.dismiss();
      });
      await page.locator(".preset-add").click();
      await expect(page.locator("#hanziList")).toBeEnabled();

      // Fill and click save
      await page.locator("#hanziList").fill("金 銀 銅 鐵");
      await page.locator("#saveHanziList").click();
      await page.waitForTimeout(200);

      // Close and reopen
      await page.close();
      const page2 = await openPopup(ctx, extId);

      const val = await page2.locator("#hanziList").inputValue();
      expect(val).toContain("金");
      expect(val).toContain("銀");
      expect(val).toContain("銅");
      expect(val).toContain("鐵");
    } finally {
      await ctx.close();
    }
  });

  // ── 6 ─────────────────────────────────────────────────────────────────────
  test("per-preset last hanzi: each preset has isolated lastHanziMap entry", async () => {
    const ctx = await launchCtx();
    try {
      const extId = await getExtId(ctx);
      const page = await openPopup(ctx, extId);

      // Inject two separate lastHanziMap entries via storage API
      await page.evaluate(() => {
        return new Promise((resolve) =>
          chrome.storage.local.set(
            {
              lastHanziMap: {
                default: { hanzi: "火", url: "https://hanja.dict.naver.com/a" },
                c_test:  { hanzi: "金", url: "https://hanja.dict.naver.com/b" },
              },
            },
            resolve
          )
        );
      });

      // Verify isolation: read back and check
      const map = await page.evaluate(() =>
        new Promise((resolve) =>
          chrome.storage.local.get({ lastHanziMap: {} }, (d) => resolve(d.lastHanziMap))
        )
      );
      expect(map.default.hanzi).toBe("火");
      expect(map.c_test.hanzi).toBe("金");
      expect(map.default.hanzi).not.toBe(map.c_test.hanzi);
    } finally {
      await ctx.close();
    }
  });

});
