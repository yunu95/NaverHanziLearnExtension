const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { test, expect, chromium } = require("@playwright/test");

const extensionPath = path.resolve(__dirname, "..");

async function launchCtx() {
  const tmpDir = path.join(
    os.tmpdir(),
    `hanja-ext-${crypto.randomBytes(4).toString("hex")}`
  );
  return chromium.launchPersistentContext(tmpDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
}

async function getExtId(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker");
  return new URL(sw.url()).host;
}

async function openPopup(context, extId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/popup.html`);
  await expect(page.locator("#presetBar")).toBeVisible();
  return page;
}

test("clicking hanzi 6 times should eventually turn gold", async () => {
  const ctx = await launchCtx();
  try {
    const extId = await getExtId(ctx);
    const popupPage = await openPopup(ctx, extId);

    await popupPage.locator(".preset-add").click();
    await popupPage.locator("#hanziList").fill("火");
    await popupPage.locator("#saveHanziList").click();
    await popupPage.waitForTimeout(500);

    const cell = popupPage.locator(".hanzi-cell").first();
    
    for (let i = 1; i <= 7; i++) {
      console.log(`\n=== Click ${i} ===`);
      
      const colorBefore = await cell.evaluate(el => el.style.backgroundColor);
      console.log(`Color before click: ${colorBefore}`);
      
      await cell.click();
      await popupPage.waitForTimeout(100);
      
      const colorAfter = await cell.evaluate(el => el.style.backgroundColor);
      console.log(`Color after click: ${colorAfter}`);
      
      // Check storage
      const storage = await popupPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.get(null, (data) => resolve(data));
        });
      });
      
      const presetId = storage.activePresetId;
      const entry = storage.hanziHistory?.[presetId]?.["火"];
      console.log(`Views: ${entry?.views}, NextReview: ${entry?.nextReview}`);
      
      // Wait for the interval to pass
      if (i <= 5) {
        const waitTime = [2000, 6000, 14000, 32000, 70000][i - 1];
        console.log(`Waiting ${waitTime}ms for review interval...`);
        await popupPage.waitForTimeout(waitTime + 500);
      }
    }
    
    await popupPage.waitForTimeout(1000);
    const finalColor = await cell.evaluate(el => el.style.backgroundColor);
    console.log(`\nFinal color: ${finalColor}`);
    console.log("Expected: rgb(255, 215, 0) or #ffd700 (gold)");
    
  } finally {
    await ctx.close();
  }
});
