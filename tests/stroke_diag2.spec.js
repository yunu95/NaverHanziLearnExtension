/**
 * Diagnostic test 2: directly inspect the animation HTML served at the SVG URL
 * and check what triggers playback.
 *
 * Run with:  npx playwright test tests/stroke_diag2.spec.js --headed
 */

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { test, chromium } = require("@playwright/test");

const edgeExecutable =
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

// Direct animation URL for 火 (706B = fire)
const ANIM_URL = "https://ssl.pstatic.net/dicimg/cckodict/aniSVG_2025_03/7000/706B.svg";
const SEARCH_URL = "https://hanja.dict.naver.com/#/search?query=%E7%81%AB";

const extensionPath = path.resolve(__dirname, "..");

async function launchCtx(loadExt = false) {
    const tmpDir = path.join(os.tmpdir(), `hanja-diag2-${crypto.randomBytes(4).toString("hex")}`);
    const args = loadExt
        ? [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
        : [];
    return chromium.launchPersistentContext(tmpDir, {
        headless: false,
        executablePath: edgeExecutable,
        args,
    });
}

// ── Test 1: inspect the animation HTML source ─────────────────────────────────
test("Inspect animation HTML source for click/autoplay mechanism", async () => {
    const ctx = await launchCtx(false); // no extension — clean context
    try {
        const page = await ctx.newPage();
        await page.goto(ANIM_URL, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2000);

        const info = await page.evaluate(() => {
            const result = {};
            const body = document.body;
            result.bodyExists = !!body;
            if (!body) return result;

            result.title = document.title;
            result.url = location.href;
            result.bodyStyle = body.getAttribute("style");
            result.allElements = body.innerHTML.substring(0, 8000);

            result.scripts = Array.from(document.querySelectorAll("script")).map((s, i) => ({
                index: i,
                src: s.src,
                contentSnippet: s.textContent.substring(0, 1200),
            }));

            result.clickableElements = Array.from(document.querySelectorAll("[onclick], [class*=play], [class*=btn], [id*=play], [id*=btn], svg, canvas")).map(el => ({
                tag: el.tagName,
                id: el.id,
                classes: el.className ? el.className.toString().substring(0, 80) : "",
                onclick: el.getAttribute("onclick"),
            }));

            result.windowKeys = Object.keys(window).filter(k =>
                k.toLowerCase().includes("play") ||
                k.toLowerCase().includes("anim") ||
                k.toLowerCase().includes("stroke") ||
                k.toLowerCase().includes("svg") ||
                k.toLowerCase().includes("start") ||
                k.toLowerCase().includes("draw") ||
                k.toLowerCase().includes("init")
            );

            return result;
        });

        console.log("=== ANIMATION PAGE SOURCE ===");
        console.log("URL:", info.url);
        console.log("Body exists:", info.bodyExists);
        console.log("Title:", info.title);
        console.log("Body style:", info.bodyStyle);
        console.log("\n--- ALL ELEMENTS (first 8000 chars) ---");
        console.log(info.allElements);
        console.log("\n--- SCRIPTS ---");
        (info.scripts || []).forEach(s => {
            console.log(`Script[${s.index}] src=${s.src || "(inline)"}`);
            console.log(s.contentSnippet);
            console.log("---");
        });
        console.log("\n--- CLICKABLE ELEMENTS ---");
        console.log(JSON.stringify(info.clickableElements, null, 2));
        console.log("\n--- WINDOW KEYS (animation-related) ---");
        console.log(JSON.stringify(info.windowKeys, null, 2));

        // Try dispatching click and watch for DOM/state changes
        const afterClick = await page.evaluate(() => {
            const body = document.body;
            if (!body) return { bodyExists: false };
            const svg = document.querySelector("svg");
            const canvas = document.querySelector("canvas");
            const target = svg || canvas || body;
            target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

            return new Promise(resolve => {
                setTimeout(() => {
                    resolve({
                        bodyAfterClick: document.body ? document.body.innerHTML.substring(0, 2000) : null,
                        svgExists: !!document.querySelector("svg"),
                        canvasExists: !!document.querySelector("canvas"),
                        animatingClass: document.body ? document.body.getAttribute("class") : null,
                    });
                }, 800);
            });
        });

        console.log("\n=== AFTER SYNTHETIC CLICK ===");
        console.log(JSON.stringify(afterClick, null, 2));

    } finally {
        await ctx.close();
    }
});

// ── Test 2: watch Naver's native behavior WITHOUT extension ──────────────────
test("Watch what Naver sends to iframe when play button is clicked", async () => {
    const ctx = await launchCtx(false); // WITHOUT extension — pure Naver behavior
    try {
        const page = await ctx.newPage();

        // Intercept postMessage calls BEFORE page JS runs
        await page.addInitScript(() => {
            const origPostMessage = window.postMessage.bind(window);
            window.__capturedMessages = [];
            window.postMessage = function(...args) {
                window.__capturedMessages.push({ args: JSON.stringify(args), ts: Date.now() });
                return origPostMessage(...args);
            };

            // Also intercept iframe postMessage sending
            const origDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
            if (origDescriptor) {
                Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
                    get() {
                        const cw = origDescriptor.get.call(this);
                        if (cw && !cw.__patched) {
                            try {
                                cw.__patched = true;
                                const origCwPM = cw.postMessage.bind(cw);
                                cw.postMessage = function(...args) {
                                    window.__capturedMessages.push({
                                        type: "to_iframe",
                                        args: JSON.stringify(args),
                                        ts: Date.now()
                                    });
                                    return origCwPM(...args);
                                };
                            } catch(e) {
                                // cross-origin frame, can't patch
                                window.__capturedMessages.push({ type: "cross_origin_frame", error: e.toString() });
                            }
                        }
                        return cw;
                    }
                });
            }
        });

        // No extension — navigate to search, click first result manually
        await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("a.hanja_link", { timeout: 15000 }).catch(() => {});
        const firstLink = page.locator("a.hanja_link").first();
        if (await firstLink.isVisible().catch(() => false)) await firstLink.click();

        await page.waitForSelector(".myFontStrokePlayBtn", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1000);

        const beforeState = await page.evaluate(() => {
            const overlay = document.querySelector("._ly_hanja_stroke");
            const iframe = overlay ? overlay.querySelector("iframe") : null;
            return {
                overlayDisplay: overlay ? getComputedStyle(overlay).display : "not found",
                overlayPosition: overlay ? getComputedStyle(overlay).position : "not found",
                iframeSrc: iframe ? iframe.src : "not found",
                capturedMessages: window.__capturedMessages,
            };
        });

        console.log("=== BEFORE PLAY CLICK (no extension) ===");
        console.log(JSON.stringify(beforeState, null, 2));

        await page.evaluate(() => window.__capturedMessages = []);

        const playBtnExists = await page.locator(".myFontStrokePlayBtn").isVisible().catch(() => false);
        if (playBtnExists) {
            await page.locator(".myFontStrokePlayBtn").click({ force: true });
            await page.waitForTimeout(2500);
        }

        const afterPlayClick = await page.evaluate(() => {
            const overlay = document.querySelector("._ly_hanja_stroke");
            const iframe = overlay ? overlay.querySelector("iframe") : document.querySelector("iframe.svgAni");
            return {
                capturedMessages: window.__capturedMessages,
                iframeSrc: iframe ? iframe.src : "not found",
                overlayDisplay: overlay ? getComputedStyle(overlay).display : "not found",
                overlayPosition: overlay ? getComputedStyle(overlay).position : "not found",
                overlayBoundingRect: overlay ? overlay.getBoundingClientRect() : null,
                iframeWidth: iframe ? iframe.getBoundingClientRect().width : 0,
                iframeHeight: iframe ? iframe.getBoundingClientRect().height : 0,
            };
        });

        console.log("\n=== AFTER PLAY BUTTON CLICK (Naver native, no extension) ===");
        console.log(JSON.stringify(afterPlayClick, null, 2));

    } finally {
        await ctx.close();
    }
});
