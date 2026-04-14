const path = require("path");
const { test, expect, chromium } = require("@playwright/test");

const extensionPath = path.resolve(__dirname, "..");
const edgeExecutable =
  process.env.EDGE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function launchExtensionContext() {
  return chromium.launchPersistentContext("", {
    headless: false,
    executablePath: edgeExecutable,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
}

async function getExtensionId(context) {
  let [serviceWorker] = context.serviceWorkers();

  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker");
  }

  return new URL(serviceWorker.url()).host;
}

test.describe("Naver Hanja extension smoke checks", () => {
  test("popup saves and restores a normalized hanja list", async () => {
    const context = await launchExtensionContext();

    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();

      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      page.once("dialog", async (dialog) => {
        await dialog.accept();
      });
      await expect(page.locator("#hanziList")).not.toHaveValue("");
      await page.locator("#hanziList").fill("\u5929, \u5730\n\u4eba   \u5929");
      await page.locator("#save").click();
      await page.reload();

      await expect(page.locator("#hanziList")).toHaveValue(
        "\u5929, \u5730, \u4eba"
      );
    } finally {
      await context.close();
    }
  });

  test("popup overwrites the previous hanja list with a new saved list", async () => {
    const context = await launchExtensionContext();

    try {
      const extensionId = await getExtensionId(context);
      const page = await context.newPage();

      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      page.on("dialog", async (dialog) => {
        await dialog.accept();
      });

      await expect(page.locator("#hanziList")).not.toHaveValue("");
      await page.locator("#hanziList").fill("\u6734 \u535A \u8236");
      await page.locator("#save").click();
      await expect(page.locator("#hanziList")).toHaveValue(
        "\u6734, \u535A, \u8236"
      );

      await page.locator("#hanziList").fill("\u5929 \u5730 \u4eba");
      await page.locator("#save").click();
      await page.reload();

      await expect(page.locator("#hanziList")).toHaveValue(
        "\u5929, \u5730, \u4eba"
      );
    } finally {
      await context.close();
    }
  });

  test("description page scrolls 한자 구성원리 section into view exactly once", async () => {
    const context = await launchExtensionContext();
    try {
      const extensionId = await getExtensionId(context);
      const popupPage = await context.newPage();
      const page = await context.newPage();

      page.on("dialog", async (dialog) => { await dialog.accept(); });

      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      popupPage.once("dialog", async (dialog) => { await dialog.accept(); });
      await popupPage.locator("#hanziList").fill("\u5929");
      await popupPage.locator("#save").click();

      // Navigate to search — content script will auto-click the best result
      await page.goto("https://hanja.dict.naver.com/#/search?query=%E5%A4%A9");

      // Wait for auto-click to land us on a description page (URL leaves /search)
      await page.waitForURL((url) => !url.toString().includes("/search"), { timeout: 15000 });

      // Let the page fully load and scroll settle
      await page.waitForTimeout(3000);


      // Snapshot element viewport position at T1
      const snap = async () => page.evaluate(() => {
        const pattern = /\ud55c\uc790\s*\uad6c\uc131\uc6d0\ub9ac/i;
        const tags = ["h1","h2","h3","dt","dd","strong","p","span","div","li"];
        for (const tag of tags) {
          for (const el of document.querySelectorAll(tag)) {
            if (pattern.test(el.textContent)) {
              const rect = el.getBoundingClientRect();
              return { found: true, top: Math.round(rect.top), inView: rect.top >= 0 && rect.top < window.innerHeight };
            }
          }
        }
        return { found: false, top: null, inView: false };
      });

      const t1 = await snap();
      console.log("T1 element state:", t1);

      // Wait another 1.5 s — repeated scrolling would shift the top value
      await page.waitForTimeout(1500);
      const t2 = await snap();
      console.log("T2 element state:", t2);

      // Element must exist on the page
      expect(t1.found).toBe(true);

      // Element must be visible in the viewport
      expect(t1.inView).toBe(true);

      // Position must be stable — no repeated scrolling
      expect(t2.top).toBe(t1.top);
    } finally {
      await context.close();
    }
  });

  test("content script keyboard navigation walks the full saved hanja sequence", async () => {
    const context = await launchExtensionContext();

    try {
      const extensionId = await getExtensionId(context);
      const popupPage = await context.newPage();
      const page = await context.newPage();

      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      popupPage.once("dialog", async (dialog) => {
        await dialog.accept();
      });
      await popupPage.locator("#hanziList").fill("\u5929 \u5730 \u4eba");
      await popupPage.locator("#save").click();

      await page.goto("https://hanja.dict.naver.com/#/search?query=%E5%A4%A9");
      await page.keyboard.down("Control");
      await page.keyboard.press("ArrowRight");
      await expect(page).toHaveURL(/query=%E5%9C%B0/);

      await page.keyboard.press("ArrowRight");
      await expect(page).toHaveURL(/query=%E4%BA%BA/);

      await page.keyboard.press("ArrowLeft");
      await expect(page).toHaveURL(/query=%E5%9C%B0/);
      await page.keyboard.up("Control");
    } finally {
      await context.close();
    }
  });
});
