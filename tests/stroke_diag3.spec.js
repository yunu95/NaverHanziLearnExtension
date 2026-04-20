/**
 * Diagnostic test 3: fetch the actual SVG animation file and inspect its content.
 * Runs from inside hanja.dict.naver.com context to match real CORS conditions.
 *
 * Run with:  npx playwright test tests/stroke_diag3.spec.js --reporter=list
 */

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { test, chromium } = require("@playwright/test");

const edgeExecutable =
    process.env.EDGE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const SEARCH_URL = "https://hanja.dict.naver.com/#/search?query=%E7%81%AB";
const SVG_URL = "https://ssl.pstatic.net/dicimg/cckodict/aniSVG_2025_03/7000/706B.svg";

async function launchCtx() {
    const tmpDir = path.join(os.tmpdir(), `hanja-diag3-${crypto.randomBytes(4).toString("hex")}`);
    return chromium.launchPersistentContext(tmpDir, {
        headless: false,
        executablePath: edgeExecutable,
        args: [],  // no extension
    });
}

test("Fetch SVG animation file from Naver page context — check CORS and content", async () => {
    const ctx = await launchCtx();
    try {
        const page = await ctx.newPage();

        // Navigate to Naver Hanja first so we have the right origin context
        await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("a.hanja_link", { timeout: 15000 }).catch(() => {});
        const firstLink = page.locator("a.hanja_link").first();
        if (await firstLink.isVisible().catch(() => false)) await firstLink.click();
        await page.waitForSelector(".myFontStrokePlayBtn", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(500);

        // Fetch the SVG URL from inside the Naver page context
        const result = await page.evaluate(async (svgUrl) => {
            try {
                const r = await fetch(svgUrl, { mode: "cors", credentials: "omit" });
                const text = await r.text();
                return {
                    ok: r.ok,
                    status: r.status,
                    corsHeaders: {
                        acao: r.headers.get("access-control-allow-origin"),
                        contentType: r.headers.get("content-type"),
                        cacheControl: r.headers.get("cache-control"),
                    },
                    contentLength: text.length,
                    first1000: text.substring(0, 1000),
                    last500: text.substring(Math.max(0, text.length - 500)),
                    // SMIL animation detection
                    hasAnimate: text.includes("<animate"),
                    hasAnimateMotion: text.includes("<animateMotion"),
                    hasBeginClick: text.includes('begin="click"') || text.includes("begin='click'"),
                    hasBeginIndefinite: text.includes('begin="indefinite"') || text.includes("begin='indefinite'"),
                    hasBeginZero: text.includes('begin="0s"') || text.includes('begin="0"'),
                    // Script detection
                    hasScript: text.includes("<script"),
                    // Structure
                    isSvg: text.trim().startsWith("<svg") || text.trim().startsWith("<?xml"),
                    isHtml: text.trim().startsWith("<!doctype") || text.trim().startsWith("<html"),
                };
            } catch (e) {
                return { error: e.toString() };
            }
        }, SVG_URL);

        console.log("=== SVG URL FETCH FROM NAVER PAGE CONTEXT ===");
        console.log("URL:", SVG_URL);
        console.log(JSON.stringify(result, null, 2));

        // If fetch succeeded, also try to load it in an iframe in-page and dispatch click
        if (result.ok && !result.error) {
            const clickTest = await page.evaluate(async (svgUrl) => {
                return new Promise((resolve) => {
                    const iframe = document.createElement("iframe");
                    iframe.style.cssText = "position:fixed;top:0;left:0;width:300px;height:300px;z-index:9999;border:none";
                    iframe.src = svgUrl;
                    document.body.appendChild(iframe);

                    iframe.addEventListener("load", () => {
                        // Check if we can access contentDocument
                        let accessible = false;
                        let svgContent = "";
                        try {
                            svgContent = iframe.contentDocument
                                ? iframe.contentDocument.documentElement.outerHTML.substring(0, 500)
                                : "(no contentDocument)";
                            accessible = true;
                        } catch (e) {
                            svgContent = "cross-origin error: " + e.toString();
                        }

                        // Try dispatching click on the iframe element
                        iframe.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

                        setTimeout(() => {
                            iframe.remove();
                            resolve({ accessible, svgContent });
                        }, 500);
                    });

                    // Timeout safety
                    setTimeout(() => {
                        iframe.remove();
                        resolve({ error: "iframe load timeout" });
                    }, 8000);
                });
            }, SVG_URL);

            console.log("\n=== IFRAME ACCESS TEST ===");
            console.log(JSON.stringify(clickTest, null, 2));
        }

    } finally {
        await ctx.close();
    }
});

test("Check if SVG animation autoplays when iframe is loaded normally", async () => {
    const ctx = await launchCtx();
    try {
        const page = await ctx.newPage();
        await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("a.hanja_link", { timeout: 15000 }).catch(() => {});
        const firstLink = page.locator("a.hanja_link").first();
        if (await firstLink.isVisible().catch(() => false)) await firstLink.click();
        await page.waitForSelector(".myFontStrokePlayBtn", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(500);

        // Simulate what our extension does: pin the overlay and set iframe.src
        // Then check if animation autoplays (observing DOM changes in SVG over time)
        const autoplays = await page.evaluate(async (svgUrl) => {
            return new Promise((resolve) => {
                const overlay = document.querySelector("._ly_hanja_stroke");
                if (!overlay) { resolve({ error: "overlay not found" }); return; }

                // Pin the overlay (same as our extension)
                overlay.id = "test-stroke-overlay";
                document.body.appendChild(overlay);
                overlay.style.cssText += ";display:block;position:fixed;top:10px;right:10px;z-index:9999;width:300px;height:300px;border:2px solid red";

                const iframe = overlay.querySelector("iframe");
                if (!iframe) { resolve({ error: "iframe not found" }); return; }

                iframe.src = svgUrl;

                // Wait for iframe to load then check if SVG is animating
                iframe.addEventListener("load", () => {
                    // Check contentDocument accessibility
                    let accessible = false;
                    let svgState = "";
                    try {
                        const doc = iframe.contentDocument;
                        svgState = doc ? doc.documentElement.outerHTML.substring(0, 200) : "no doc";
                        accessible = true;
                    } catch (e) {
                        svgState = "cross-origin: " + e.toString();
                    }

                    // Check iframe dimensions
                    const rect = iframe.getBoundingClientRect();

                    resolve({
                        accessible,
                        svgState,
                        iframeWidth: rect.width,
                        iframeHeight: rect.height,
                        iframeLoaded: true,
                    });
                }, { once: true });

                setTimeout(() => resolve({ error: "load timeout" }), 10000);
            });
        }, SVG_URL);

        console.log("=== AUTOPLAY TEST (extension-style pinning) ===");
        console.log(JSON.stringify(autoplays, null, 2));

    } finally {
        await ctx.close();
    }
});
