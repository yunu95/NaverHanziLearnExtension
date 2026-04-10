chrome.runtime.onInstalled.addListener((details) => {
    console.log("[Hanzi Ext] Background worker ready:", details.reason);
});
