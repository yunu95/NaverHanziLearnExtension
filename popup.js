const textarea = document.getElementById("hanziList");
const saveButton = document.getElementById("save");

const HANZI_PATTERN = /\p{Script=Han}/gu;

const expandToken = (token) => {
    const normalized = String(token ?? "").trim();
    if (!normalized) {
        return [];
    }

    const hanziMatches = normalized.match(HANZI_PATTERN);
    if (hanziMatches && hanziMatches.length > 0) {
        return hanziMatches;
    }

    return [normalized];
};

const parseHanziList = (rawText) =>
    Array.from(
        new Set(
            String(rawText)
                .split(/[\s,]+/g)
                .flatMap(expandToken)
                .filter(Boolean)
        )
    );

const renderSavedHanzis = () => {
    chrome.storage.local.get({ hanzis: [] }, (data) => {
        textarea.value = Array.isArray(data.hanzis) ? data.hanzis.join(", ") : "";
    });
};

saveButton.addEventListener("click", () => {
    const hanziList = parseHanziList(textarea.value);

    chrome.storage.local.set({ hanzis: hanziList }, () => {
        textarea.value = hanziList.join(", ");
        alert("Hanzis saved!");
    });
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSavedHanzis, { once: true });
} else {
    renderSavedHanzis();
}
