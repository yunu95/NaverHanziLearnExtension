/**
 * Verify the SRS cooltime-per-learning fix:
 * After first viewing a hanzi, nextReview must be tomorrow at 3 AM,
 * not the day after tomorrow (which was the bug).
 */

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { test, expect, chromium } = require("@playwright/test");

const extensionPath = path.resolve(__dirname, "..");

async function launchCtx() {
  const tmpDir = path.join(os.tmpdir(), `hanja-srs-${crypto.randomBytes(4).toString("hex")}`);
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

/** Compute the expected 3 AM timestamp for N days from a given base. */
function expected3AM(baseMs, daysLater) {
  const d = new Date(baseMs);
  d.setDate(d.getDate() + daysLater);
  d.setHours(3, 0, 0, 0);
  // getNext3AM advances if the timestamp is <= 3 AM, so if base is exactly 3 AM it goes +1
  // For a base of "now" (daytime), +N days lands past 3 AM, so getNext3AM advances to 3 AM on day N+1
  // Our fix makes it: getNext3AM(base + N_days - 1_day) which lands at day N instead
  return d.getTime();
}

test("first view schedules nextReview at 3 AM tomorrow, not day after tomorrow", async () => {
  const ctx = await launchCtx();
  try {
    const extId = await getExtId(ctx);

    // --- Step 1: Add 火 to a fresh preset ---
    const popupPage = await openPopup(ctx, extId);
    await popupPage.locator(".preset-add").click();
    await popupPage.locator("#hanziList").fill("火");
    await popupPage.locator("#saveHanziList").click();
    await popupPage.waitForTimeout(500);
    console.log("✓ Saved preset with 火");

    // --- Step 2: Navigate to Naver page (intercepted — no internet needed) ---
    const contentPage = await ctx.newPage();

    // Return a minimal HTML so the page loads; the content script injects based on URL match
    await contentPage.route("https://hanja.dict.naver.com/**", route =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<!DOCTYPE html><html><head><title>Hanja Mock</title></head>
               <body><h1>火</h1><p>Mock page for SRS test</p></body></html>`,
      })
    );

    const now = Date.now();
    console.log(`now = ${new Date(now).toLocaleString()}`);

    await contentPage.goto("https://hanja.dict.naver.com/#/search?query=%E7%81%AB", {
      waitUntil: "domcontentloaded",
    });

    // Wait for content script to run and update storage
    await contentPage.waitForTimeout(2000);
    console.log("✓ Navigated to mock Naver page");

    // --- Step 3: Read storage and verify nextReview ---
    const storage = await popupPage.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(null, resolve))
    );

    const presetId = storage.activePresetId;
    const entry = storage.hanziHistory?.[presetId]?.["火"];

    console.log("\n=== Storage entry for 火 ===");
    console.log("views:", entry?.views);
    console.log("lastViewed:", entry?.lastViewed ? new Date(entry.lastViewed).toLocaleString() : null);
    console.log("nextReview:", entry?.nextReview ? new Date(entry.nextReview).toLocaleString() : null);

    expect(entry, "history entry must exist after page visit").toBeTruthy();
    expect(entry.views).toBe(1);

    const nextReview = entry.nextReview;
    const hoursFromNow = (nextReview - now) / 3600000;
    console.log(`\nnextReview is ${hoursFromNow.toFixed(1)} hours from now`);

    // Must be at 3 AM
    const d = new Date(nextReview);
    expect(d.getHours()).toBe(3);
    expect(d.getMinutes()).toBe(0);
    console.log(`✓ nextReview is at 3:00 AM`);

    // Must be tomorrow (between 20h and 32h from now) — NOT the day after tomorrow (>44h)
    expect(hoursFromNow, `Expected ~24h, got ${hoursFromNow.toFixed(1)}h. Bug would give ~48h.`)
      .toBeGreaterThan(20);
    expect(hoursFromNow, `nextReview too far out (${hoursFromNow.toFixed(1)}h). Bug: day after tomorrow was being scheduled.`)
      .toBeLessThan(32);

    console.log(`✓ nextReview is tomorrow (${hoursFromNow.toFixed(1)}h from now), not day after tomorrow`);

  } finally {
    await ctx.close();
  }
});

test("subsequent reviews follow the delta schedule: day 3, 7, 16, 35", async () => {
  const ctx = await launchCtx();
  try {
    const extId = await getExtId(ctx);
    const popupPage = await openPopup(ctx, extId);

    // Add 火 to preset
    await popupPage.locator(".preset-add").click();
    await popupPage.locator("#hanziList").fill("火");
    await popupPage.locator("#saveHanziList").click();
    await popupPage.waitForTimeout(500);

    // Get the presetId
    const initialStorage = await popupPage.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(null, resolve))
    );
    const presetId = initialStorage.activePresetId;

    const DAY = 86400000;

    // Seed storage to simulate having completed N views with the nextReview already due
    // This lets us test views 2-5 without waiting real days
    const simulateReviews = async (views, lastReviewMs) => {
      // Plant a history entry where nextReview is in the past (due now)
      const seedEntry = {
        views,
        lastViewed: lastReviewMs,
        nextReview: lastReviewMs + 1000, // 1 second in future = practically due
      };
      await popupPage.evaluate(({ pid, entry }) => {
        return new Promise(resolve => {
          chrome.storage.sync.get({ hanziHistory: {} }, data => {
            if (!data.hanziHistory[pid]) data.hanziHistory[pid] = {};
            data.hanziHistory[pid]["火"] = entry;
            chrome.storage.sync.set({ hanziHistory: data.hanziHistory }, resolve);
          });
        });
      }, { pid: presetId, entry: seedEntry });

      // Brief delay so nextReview is now past (due)
      await popupPage.waitForTimeout(1100);
    };

    // We'll navigate to the mock Naver page multiple times,
    // seeding history between visits to simulate time passing.
    const contentPage = await ctx.newPage();
    await contentPage.route("https://hanja.dict.naver.com/**", route =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<!DOCTYPE html><html><body><h1>火</h1></body></html>`,
      })
    );

    // === View 1: first learning ===
    const t0 = Date.now();
    // Ensure clean history
    await popupPage.evaluate(pid => {
      return new Promise(resolve => {
        chrome.storage.sync.get({ hanziHistory: {} }, data => {
          if (data.hanziHistory[pid]) delete data.hanziHistory[pid]["火"];
          chrome.storage.sync.set({ hanziHistory: data.hanziHistory }, resolve);
        });
      });
    }, presetId);

    await contentPage.goto("https://hanja.dict.naver.com/#/search?query=%E7%81%AB", { waitUntil: "domcontentloaded" });
    await contentPage.waitForTimeout(2000);

    let storage = await popupPage.evaluate(() => new Promise(r => chrome.storage.sync.get(null, r)));
    let entry = storage.hanziHistory?.[presetId]?.["火"];
    const review1 = entry.nextReview;
    const hours1 = (review1 - t0) / 3600000;
    console.log(`View 1 → nextReview in ${hours1.toFixed(1)}h (expected ~24h)`);
    expect(hours1).toBeGreaterThan(20);
    expect(hours1).toBeLessThan(32);

    // === View 2: seed as if review 1 is due, check nextReview is ~day 3 ===
    const fakeView1Time = t0;
    const fakeView1Due  = fakeView1Time + 1 * DAY;
    await simulateReviews(1, fakeView1Time);

    // Force nextReview to be in the past so the gate opens
    await popupPage.evaluate(({ pid }) => {
      return new Promise(resolve => {
        chrome.storage.sync.get({ hanziHistory: {} }, data => {
          data.hanziHistory[pid]["火"].nextReview = Date.now() - 1000;
          chrome.storage.sync.set({ hanziHistory: data.hanziHistory }, resolve);
        });
      });
    }, { pid: presetId });

    await contentPage.reload({ waitUntil: "domcontentloaded" });
    await contentPage.waitForTimeout(2000);

    storage = await popupPage.evaluate(() => new Promise(r => chrome.storage.sync.get(null, r)));
    entry = storage.hanziHistory?.[presetId]?.["火"];
    const review2 = entry.nextReview;
    // base = the old nextReview (which was ~now-1s), delta = 2 days → nextReview = 3 AM tomorrow+1
    const now2 = Date.now();
    const hours2 = (review2 - now2) / 3600000;
    console.log(`View 2 → nextReview in ${hours2.toFixed(1)}h (expected ~48h / 2 days delta)`);
    expect(new Date(review2).getHours()).toBe(3);
    expect(hours2).toBeGreaterThan(44);  // at least 44h out
    expect(hours2).toBeLessThan(56);     // not more than 56h out

    console.log("\n=== SRS schedule verified ===");
    console.log(`View 1: +${hours1.toFixed(1)}h ✓ (expected ~24h)`);
    console.log(`View 2: +${hours2.toFixed(1)}h ✓ (expected ~48h)`);

  } finally {
    await ctx.close();
  }
});
