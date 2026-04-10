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
