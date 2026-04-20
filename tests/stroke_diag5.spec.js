/**
 * Diagnostic test 5: directly fetch the JS and CSS animation library files
 * to understand what triggers animation playback and what CSS properties control it.
 *
 * Run with:  npx playwright test tests/stroke_diag5.spec.js --reporter=list
 */

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { test, chromium } = require("@playwright/test");

const edgeExecutable =
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const JS_URL = "https://ssl.pstatic.net/dicimg/cckodict/aniSVG_2025_03/libs/gna.lib.svg.ani.min.js";
const CSS_URL = "https://ssl.pstatic.net/dicimg/cckodict/aniSVG_2025_03/libs/opmGna.svg.ani.min.css";

async function launchCtx(name) {
    const tmpDir = path.join(os.tmpdir(), `hanja-diag5-${name}-${crypto.randomBytes(4).toString("hex")}`);
    return chromium.launchPersistentContext(tmpDir, {
        headless: false,
        executablePath: edgeExecutable,
    });
}

test("Fetch CSS animation library directly", async () => {
    const ctx = await launchCtx("css");
    try {
        const page = await ctx.newPage();
        let cssContent = "";

        page.on("response", async (response) => {
            if (response.url() === CSS_URL) {
                try { cssContent = await response.text(); } catch (e) {}
            }
        });

        await page.goto(CSS_URL, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);

        if (!cssContent) {
            // Try getting it from the page content (browser may display it as text)
            cssContent = await page.evaluate(() => document.body ? document.body.innerText : document.documentElement.innerText || "").catch(() => "");
        }

        console.log("=== CSS LIBRARY CONTENT ===");
        console.log("URL:", CSS_URL);
        console.log("Length:", cssContent.length);
        console.log("\n--- FULL CONTENT ---");
        console.log(cssContent);

    } finally {
        await ctx.close();
    }
});

test("Fetch JS animation library directly", async () => {
    const ctx = await launchCtx("js");
    try {
        const page = await ctx.newPage();
        let jsContent = "";

        page.on("response", async (response) => {
            if (response.url() === JS_URL) {
                try { jsContent = await response.text(); } catch (e) {}
            }
        });

        await page.goto(JS_URL, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);

        if (!jsContent) {
            jsContent = await page.evaluate(() => document.body ? document.body.innerText : document.documentElement.innerText || "").catch(() => "");
        }

        console.log("=== JS LIBRARY CONTENT ===");
        console.log("URL:", JS_URL);
        console.log("Length:", jsContent.length);
        console.log("\n--- FULL CONTENT ---");
        console.log(jsContent);

        // Highlight key patterns
        if (jsContent) {
            console.log("\n--- KEY PATTERN ANALYSIS ---");
            console.log("Has 'click':", jsContent.includes("click"));
            console.log("Has 'play':", jsContent.toLowerCase().includes("play"));
            console.log("Has 'animation-play-state':", jsContent.includes("animation-play-state"));
            console.log("Has 'paused':", jsContent.includes("paused"));
            console.log("Has 'running':", jsContent.includes("running"));
            console.log("Has addEventListener:", jsContent.includes("addEventListener"));
            console.log("Has 'beginElement':", jsContent.includes("beginElement"));
            console.log("Has 'autoplay':", jsContent.toLowerCase().includes("autoplay"));
            console.log("Has 'load':", jsContent.includes("load"));
            console.log("Has 'DOMContentLoaded':", jsContent.includes("DOMContentLoaded"));
            console.log("Has 'onload':", jsContent.includes("onload"));
            console.log("Has postMessage:", jsContent.includes("postMessage"));
            console.log("Has '--d':", jsContent.includes("--d"));
            console.log("Has '--t':", jsContent.includes("--t"));
            console.log("Has 'stroke-dashoffset':", jsContent.includes("stroke-dashoffset"));
            console.log("Has 'classList':", jsContent.includes("classList"));
        }

    } finally {
        await ctx.close();
    }
});
