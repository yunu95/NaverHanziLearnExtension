/**
 * Test to verify that clicking a hanzi cell updates its color after visiting the page
 */

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

test("clicking hanzi cell updates color after page load", async () => {
  const ctx = await launchCtx();
  try {
    const extId = await getExtId(ctx);
    
    // Step 1: Open popup and create custom preset with one hanzi
    console.log("Step 1: Creating custom preset...");
    let popupPage = await openPopup(ctx, extId);
    
    await popupPage.locator(".preset-add").click();
    await popupPage.locator("#hanziList").fill("火");
    await popupPage.locator("#saveHanziList").click();
    
    // Step 2: Check initial color (should be gray)
    console.log("Step 2: Checking initial color...");
    await popupPage.waitForTimeout(500); // Wait for grid to render
    
    const cellCount = await popupPage.locator(".hanzi-cell").count();
    console.log("Number of cells:", cellCount);
    
    const initialCell = popupPage.locator(".hanzi-cell").first();
    await expect(initialCell).toBeVisible();
    
    const cellText = await initialCell.textContent();
    const cellStyle = await initialCell.evaluate((el) => el.style.backgroundColor);
    const computedStyle = await initialCell.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    
    console.log("Cell text:", cellText);
    console.log("Inline style:", cellStyle);
    console.log("Computed style:", computedStyle);
    
    expect(cellStyle).toBeTruthy(); // Should have inline style
    
    // Step 3: Click the cell to navigate to dictionary
    console.log("Step 3: Clicking cell to navigate...");
    console.log("Pages before click:", ctx.pages().length);
    await initialCell.click();
    
    // Step 4: Wait a bit and check for new pages
    console.log("Step 4: Waiting for navigation...");
    await popupPage.waitForTimeout(2000);
    const pages = ctx.pages();
    console.log("Pages after click:", pages.length);
    pages.forEach((p, i) => console.log(`  Page ${i}: ${p.url()}`));
    
    const dictPage = pages.find(p => p.url().includes("hanja.dict.naver.com"));
    
    if (dictPage) {
      console.log("Dictionary page found:", dictPage.url());
      await dictPage.waitForLoadState("domcontentloaded");
      await dictPage.waitForTimeout(3000); // Wait for content script
      
      // Check if panel rendered
      const panelExists = await dictPage.locator("#hanzi-ext-panel").count();
      console.log("Panel exists:", panelExists > 0);
      
      await dictPage.close();
    } else {
      console.log("WARNING: No dictionary page found!");
    }
    
    // Step 5: Reopen popup and check color
    console.log("Step 5: Reopening popup...");
    popupPage = await openPopup(ctx, extId);
    
    const updatedCell = popupPage.locator(".hanzi-cell").first();
    await expect(updatedCell).toBeVisible();
    const updatedColor = await updatedCell.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    console.log("Updated color:", updatedColor);
    
    // Step 6: Check storage directly
    console.log("Step 6: Checking storage...");
    const storageData = await popupPage.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, (data) => resolve(data));
      });
    });
    console.log("Storage data:", JSON.stringify(storageData, null, 2));
    
    // The color should have changed from gray
    expect(updatedColor).not.toBe("rgb(128, 128, 128)");
    console.log("✓ Color updated successfully!");
    
  } catch (error) {
    console.error("Test failed:", error);
    throw error;
  } finally {
    await ctx.close();
  }
});
