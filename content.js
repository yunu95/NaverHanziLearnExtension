const STORAGE_KEY = "hanzis";
const SEARCH_URL_PREFIX = "https://hanja.dict.naver.com/#/search?query=";
const DESCRIPTION_MAP_KEY = "hanziDescriptionMap";
const HANZI_SIGNATURE_KEY = "hanziListSignature";

let hanzis = [];
let hanziIndexMap = new Map();
let hanzisLoaded = false;
let activeSearchTimer = null;
let activeScrollTimer = null;
let activeScrollObserver = null;
let lastHandledUrl = "";

const normalizeEntry = (value) =>
    String(value ?? "")
        .normalize("NFC")
        .trim()
        .replace(/^[\s"']+|[\s"']+$/g, "");

const normalizeHanziList = (list) =>
    Array.from(new Set((Array.isArray(list) ? list : []).map(normalizeEntry).filter(Boolean)));

const buildSearchUrl = (hanzi) => `${SEARCH_URL_PREFIX}${encodeURIComponent(hanzi)}`;

const normalizeLookupUrl = (urlLike) => {
    try {
        const url = new URL(urlLike, window.location.href);
        const hashPath = (url.hash || "").split("?")[0];
        return `${url.origin}${url.pathname}${hashPath}`;
    } catch (error) {
        return normalizeEntry(urlLike);
    }
};

const readDescriptionMap = () => {
    try {
        const raw = sessionStorage.getItem(DESCRIPTION_MAP_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
        return {};
    }
};

const writeDescriptionMap = (map) => {
    try {
        sessionStorage.setItem(DESCRIPTION_MAP_KEY, JSON.stringify(map));
    } catch (error) {
        console.warn("[Hanzi Ext] Failed to persist description map:", error);
    }
};

const clearDescriptionMap = () => {
    writeDescriptionMap({});
};

const getHanziListSignature = (list) => JSON.stringify(normalizeHanziList(list));

const rememberDescriptionHanzi = (urlLike, hanzi) => {
    const target = normalizeEntry(hanzi);
    const normalizedUrl = normalizeLookupUrl(urlLike);
    if (!target || !normalizedUrl) {
        return;
    }

    const descriptionMap = readDescriptionMap();
    descriptionMap[normalizedUrl] = target;
    writeDescriptionMap(descriptionMap);
};

const getRememberedDescriptionHanzi = (urlLike = window.location.href) => {
    const normalizedUrl = normalizeLookupUrl(urlLike);
    if (!normalizedUrl) {
        return "";
    }

    const descriptionMap = readDescriptionMap();
    return findSavedHanziInText(descriptionMap[normalizedUrl]);
};

const setHanzis = (list) => {
    const nextHanzis = normalizeHanziList(list);
    const nextSignature = getHanziListSignature(nextHanzis);
    const previousSignature = sessionStorage.getItem(HANZI_SIGNATURE_KEY);

    if (previousSignature && previousSignature !== nextSignature) {
        clearDescriptionMap();
    }

    sessionStorage.setItem(HANZI_SIGNATURE_KEY, nextSignature);
    hanzis = nextHanzis;
    hanziIndexMap = new Map(hanzis.map((hanzi, index) => [hanzi, index]));
    hanzisLoaded = true;
    return hanzis;
};

const findSavedHanziInText = (value) => {
    const text = normalizeEntry(value);
    if (!text) {
        return "";
    }

    if (hanziIndexMap.has(text)) {
        return text;
    }

    for (const hanzi of hanzis) {
        if (text.includes(hanzi)) {
            return hanzi;
        }
    }

    return "";
};

const loadHanzis = () =>
    new Promise((resolve) => {
        chrome.storage.local.get({ [STORAGE_KEY]: [] }, (data) => {
            resolve(setHanzis(data[STORAGE_KEY]));
        });
    });

const ensureHanzisLoaded = async () => {
    if (!hanzisLoaded) {
        await loadHanzis();
    }
    return hanzis;
};

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) {
        return;
    }

    setHanzis(changes[STORAGE_KEY].newValue);
    console.log("[Hanzi Ext] Updated hanja list from storage:", hanzis);
});

const getCurrentHanziFromLocation = () => {
    const hash = window.location.hash || "";

    if (hash.includes("?")) {
        const hashParams = new URLSearchParams(hash.split("?")[1] || "");
        const query = hashParams.get("query") || hashParams.get("q");
        if (query) {
            return findSavedHanziInText(query) || normalizeEntry(query);
        }
    }

    const searchParams = new URLSearchParams(window.location.search);
    const query = searchParams.get("query") || searchParams.get("q");
    if (query) {
        return findSavedHanziInText(query) || normalizeEntry(query);
    }

    return "";
};

const getCurrentHanziFromDescription = () => {
    const rememberedHanzi = getRememberedDescriptionHanzi();
    if (rememberedHanzi) {
        return rememberedHanzi;
    }

    const selectors = [
        "h1",
        "h2",
        ".title",
        ".tit",
        ".entry_title",
        ".word",
        ".hanja",
        ".hanja_word",
        "[class*='title']",
        "[class*='word']",
        "[class*='hanja']",
        "dt",
        "strong",
    ];

    for (const selector of selectors) {
        for (const element of document.querySelectorAll(selector)) {
            const matchedHanzi = findSavedHanziInText(element.textContent);
            if (matchedHanzi) {
                rememberDescriptionHanzi(window.location.href, matchedHanzi);
                return matchedHanzi;
            }
        }
    }

    return "";
};

const getCurrentHanzi = () => {
    const locationHanzi = getCurrentHanziFromLocation();
    if (locationHanzi && hanziIndexMap.has(locationHanzi)) {
        return locationHanzi;
    }

    const descriptionHanzi = getCurrentHanziFromDescription();
    if (descriptionHanzi) {
        return descriptionHanzi;
    }

    const title = normalizeEntry(document.title);
    if (!title) {
        return "";
    }

    const titleHanzi = findSavedHanziInText(title);
    if (titleHanzi) {
        return titleHanzi;
    }

    const firstChunk = title.split(/[|]/)[0] || title;
    return normalizeEntry(firstChunk.split(/\s+/)[0]);
};

const clearTimers = () => {
    if (activeSearchTimer) {
        clearInterval(activeSearchTimer);
        activeSearchTimer = null;
    }

    if (activeScrollTimer) {
        clearTimeout(activeScrollTimer);
        activeScrollTimer = null;
    }

    if (activeScrollObserver) {
        activeScrollObserver.disconnect();
        activeScrollObserver = null;
    }
};

const goToHanzi = (hanzi) => {
    const target = normalizeEntry(hanzi);
    if (!target) {
        return;
    }

    window.location.assign(buildSearchUrl(target));
};

const navigateToOffset = async (offset) => {
    await ensureHanzisLoaded();

    if (hanzis.length === 0) {
        alert("Please save some Hanzis in the extension popup first.");
        return;
    }

    const currentHanzi = getCurrentHanzi();
    let currentIndex = hanziIndexMap.has(currentHanzi) ? hanziIndexMap.get(currentHanzi) : -1;

    if (currentIndex === -1) {
        currentIndex = offset > 0 ? -1 : hanzis.length;
    }

    const nextIndex = currentIndex + offset;
    if (nextIndex < 0 || nextIndex >= hanzis.length) {
        alert(offset > 0 ? "No more next Hanzi." : "No more previous Hanzi.");
        return;
    }

    goToHanzi(hanzis[nextIndex]);
};

const resetHanziIndex = async () => {
    await ensureHanzisLoaded();

    if (hanzis.length === 0) {
        alert("Please save some Hanzis in the extension popup first.");
        return;
    }

    goToHanzi(hanzis[0]);
};

const getResultLinks = () => {
    const selectors = [
        "#searchLetterPage_content .hanja_word a.hanja_link",
        "#searchLetterPage_content a.hanja_link",
        "a.hanja_link",
    ];

    const seen = new Set();
    const links = [];

    for (const selector of selectors) {
        for (const link of document.querySelectorAll(selector)) {
            if (!seen.has(link)) {
                seen.add(link);
                links.push(link);
            }
        }
    }

    return links;
};

const findBestResultLink = (currentHanzi) => {
    const links = getResultLinks();
    if (links.length === 0) {
        return null;
    }

    if (!currentHanzi) {
        return links[0];
    }

    const encodedHanzi = encodeURIComponent(currentHanzi);
    return (
        links.find((link) => {
            const text = normalizeEntry(link.textContent);
            const href = link.getAttribute("href") || "";
            return (
                text === currentHanzi ||
                text.includes(currentHanzi) ||
                href.includes(encodedHanzi) ||
                href.includes(currentHanzi)
            );
        }) || links[0]
    );
};

const startSearchResultClicker = async () => {
    await ensureHanzisLoaded();

    const currentHanzi = getCurrentHanzi();
    let attempts = 0;

    const tryClickEntry = () => {
        const targetLink = findBestResultLink(currentHanzi);
        if (!targetLink) {
            return false;
        }

        rememberDescriptionHanzi(targetLink.href || targetLink.getAttribute("href") || "", currentHanzi);
        targetLink.click();
        return true;
    };

    activeSearchTimer = setInterval(() => {
        attempts += 1;
        if (tryClickEntry() || attempts >= 50) {
            clearTimers();
        }
    }, 100);
};

const getBestScrollTarget = (element) => {
    if (!element) {
        return null;
    }

    return (
        element.closest("section, article, dl, div, li") ||
        element.parentElement ||
        element
    );
};

const findDescriptionSection = () => {
    const primaryPattern = /\ud55c\uc790\s*\uad6c\uc131\uc6d0\ub9ac/i;
    const fallbackPatterns = [/\uad6c\uc131/i, /\u5b57\u5f62/i];
    const selectors = [
        "h1",
        "h2",
        "h3",
        "dt",
        "dd",
        "strong",
        "p",
        "span",
        "div",
        "li",
    ];

    for (const selector of selectors) {
        for (const element of document.querySelectorAll(selector)) {
            const text = normalizeEntry(element.textContent);
            if (primaryPattern.test(text)) {
                return getBestScrollTarget(element);
            }
        }
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const text = normalizeEntry(node.textContent);
            if (!text) {
                return NodeFilter.FILTER_REJECT;
            }

            return primaryPattern.test(text) || fallbackPatterns.some((pattern) => pattern.test(text))
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        },
    });

    let textNode = walker.nextNode();
    while (textNode) {
        if (textNode.parentElement) {
            return getBestScrollTarget(textNode.parentElement);
        }
        textNode = walker.nextNode();
    }

    return null;
};

const startDescriptionScroller = () => {
    let attempts = 0;

    const tryScroll = () => {
        const element = findDescriptionSection();
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            activeScrollTimer = setTimeout(() => {
                element.scrollIntoView({ behavior: "smooth", block: "start" });
                clearTimers();
            }, 300);
            if (activeScrollObserver) {
                activeScrollObserver.disconnect();
                activeScrollObserver = null;
            }
            return;
        }

        attempts += 1;
        if (attempts >= 40) {
            clearTimers();
            return;
        }
    };

    const startWatching = () => {
        tryScroll();
        activeScrollTimer = setInterval(tryScroll, 250);
        activeScrollObserver = new MutationObserver(() => {
            tryScroll();
        });
        activeScrollObserver.observe(document.documentElement, { childList: true, subtree: true });
    };

    if (document.readyState === "complete") {
        startWatching();
        return;
    }

    window.addEventListener("load", startWatching, { once: true });
};

const initPageLogic = async () => {
    const currentUrl = window.location.href;
    if (currentUrl === lastHandledUrl) {
        return;
    }

    lastHandledUrl = currentUrl;
    clearTimers();

    const isSearchPage =
        /\/search/.test(currentUrl) &&
        (/query=/.test(currentUrl) || /q=/.test(currentUrl) || window.location.hash.includes("/search"));

    if (isSearchPage) {
        await startSearchResultClicker();
        return;
    }

    startDescriptionScroller();
};

const scheduleInit = () => {
    initPageLogic().catch((error) => {
        console.error("[Hanzi Ext] Failed to initialize page logic:", error);
    });
};

document.addEventListener("keydown", async (event) => {
    if (!event.ctrlKey) {
        return;
    }

    if (event.key === "ArrowRight") {
        event.preventDefault();
        await navigateToOffset(1);
    } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        await navigateToOffset(-1);
    } else if (event.key === "ArrowDown") {
        event.preventDefault();
        await resetHanziIndex();
    }
});

window.addEventListener("hashchange", scheduleInit);
window.addEventListener("popstate", scheduleInit);

new MutationObserver(() => {
    if (window.location.href !== lastHandledUrl) {
        scheduleInit();
    }
}).observe(document.documentElement, { childList: true, subtree: true });

const start = async () => {
    await loadHanzis();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scheduleInit, { once: true });
    } else {
        scheduleInit();
    }
};

start();
