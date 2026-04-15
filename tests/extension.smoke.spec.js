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

      await expect(page.locator(".preset-default")).toHaveClass(/preset-active/);
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
      await expect(page.locator(".preset-default")).not.toHaveClass(/preset-active/);
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
      await page.locator(".preset-default").click();
      await expect(page.locator(".preset-default")).toHaveClass(/preset-active/);
      await expect(page.locator(".preset-item").first()).not.toHaveClass(/preset-active/);

      // Go back to custom
      await page.locator(".preset-name").first().click();
      await expect(page.locator(".preset-item").first()).toHaveClass(/preset-active/);
      await expect(page.locator(".preset-default")).not.toHaveClass(/preset-active/);
    } finally {
      await ctx.close();
    }
  });

  // ── 4 ─────────────────────────────────────────────────────────────────────
  test("activePresetId persists after popup is closed and reopened", async () => {
    const ctx = await launchCtx();
    try {
      const extId = await getExtId(ctx);
      const page = await openPopup(ctx, extId);

      page.on("dialog", async (d) => {
        if (d.type() === "prompt") await d.accept("영구저장");
        else await d.dismiss();
      });
      await page.locator(".preset-add").click();
      await expect(page.locator(".preset-item").first()).toHaveClass(/preset-active/);

      // Close popup, open fresh page (same storage)
      await page.close();
      const page2 = await openPopup(ctx, extId);

      // Custom preset must still be active after reopen
      await expect(page2.locator(".preset-item").first()).toHaveClass(/preset-active/);
      await expect(page2.locator(".preset-default")).not.toHaveClass(/preset-active/);
    } finally {
      await ctx.close();
    }
  });

  // ── 5 ─────────────────────────────────────────────────────────────────────
  test("blur saves textarea content; it is restored on next popup open", async () => {
    const ctx = await launchCtx();
    try {
      const extId = await getExtId(ctx);
      const page = await openPopup(ctx, extId);

      page.on("dialog", async (d) => {
        if (d.type() === "prompt") await d.accept("블러테스트");
        else await d.dismiss();
      });
      await page.locator(".preset-add").click();
      await expect(page.locator("#hanziList")).toBeEnabled();

      // Fill and blur
      await page.locator("#hanziList").fill("金 銀 銅 鐵");
      await page.locator("h1").click();          // triggers blur
      await page.waitForTimeout(300);            // let blur handler run

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
  test("editing textarea under custom preset does NOT flip activePresetId to 기본", async () => {
    const ctx = await launchCtx();
    try {
      const extId = await getExtId(ctx);
      const page = await openPopup(ctx, extId);

      page.on("dialog", async (d) => {
        if (d.type() === "prompt") await d.accept("플립테스트");
        else await d.dismiss();
      });
      await page.locator(".preset-add").click();
      await expect(page.locator(".preset-item").first()).toHaveClass(/preset-active/);

      // Type something in textarea — previously this could trigger syncActivePreset
      // and flip the active preset back to 기본 if content matched the default list.
      await page.locator("#hanziList").fill("火 水 木");
      await page.waitForTimeout(500);   // wait past debounce

      // Custom preset must still be active
      await expect(page.locator(".preset-item").first()).toHaveClass(/preset-active/);
      await expect(page.locator(".preset-default")).not.toHaveClass(/preset-active/);
    } finally {
      await ctx.close();
    }
  });

  // ── 7 ─────────────────────────────────────────────────────────────────────
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

  // ── 8 ─────────────────────────────────────────────────────────────────────
  // Explicit blur+wait before switching — baseline
  test("edited textarea is restored when switching away and back (explicit blur)", async () => {
    const ctx = await launchCtx();
    try {
      const extId = await getExtId(ctx);
      const page = await openPopup(ctx, extId);

      page.on("dialog", async (d) => {
        if (d.type() === "prompt") await d.accept("편집테스트");
        else await d.dismiss();
      });
      await page.locator(".preset-add").click();
      await expect(page.locator(".preset-item").first()).toHaveClass(/preset-active/);

      await page.locator("#hanziList").fill("月 日 星");
      await page.locator("h1").click();   // explicit blur
      await page.waitForTimeout(400);     // let async save finish

      await page.locator(".preset-default").click();
      await page.locator(".preset-name").first().click();

      const val = await page.locator("#hanziList").inputValue();
      expect(val).toContain("月");
      expect(val).toContain("日");
      expect(val).toContain("星");
    } finally {
      await ctx.close();
    }
  });

  // ── 9 ─────────────────────────────────────────────────────────────────────
  // Direct click to another preset (no explicit blur) — the real user scenario
  test("edited textarea is restored when clicking directly to another preset and back (no explicit blur)", async () => {
    const ctx = await launchCtx();
    try {
      const extId = await getExtId(ctx);
      const page = await openPopup(ctx, extId);

      page.on("dialog", async (d) => {
        if (d.type() === "prompt") await d.accept("직접클릭");
        else await d.dismiss();
      });
      await page.locator(".preset-add").click();
      await expect(page.locator(".preset-item").first()).toHaveClass(/preset-active/);

      // Edit WITHOUT explicit blur — directly click away
      await page.locator("#hanziList").fill("月 日 星");
      await page.locator(".preset-default").click();   // blur fires implicitly here
      await expect(page.locator(".preset-default")).toHaveClass(/preset-active/);

      // Wait for all async saves to settle
      await page.waitForTimeout(500);

      // Click back to the custom preset
      await page.locator(".preset-name").first().click();
      await expect(page.locator(".preset-item").first()).toHaveClass(/preset-active/);

      const val = await page.locator("#hanziList").inputValue();
      expect(val).toContain("月");
      expect(val).toContain("日");
      expect(val).toContain("星");
    } finally {
      await ctx.close();
    }
  });

});
