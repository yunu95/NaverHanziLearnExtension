const textarea = document.getElementById("hanziList");
const goToLastHanziButton = document.getElementById("goToLastHanzi");
const lastHanziInfo = document.getElementById("lastHanziInfo");

const PRESETS_KEY = "presets";

let activePresetId = null;

const loadPresets = (callback) => {
    chrome.storage.local.get({ [PRESETS_KEY]: [] }, (data) => callback(data[PRESETS_KEY]));
};

const savePresets = (presets, callback) => {
    chrome.storage.local.set({ [PRESETS_KEY]: presets }, callback);
};

const getHanziSignature = (hanzis) => [...hanzis].sort().join(",");

const syncActivePreset = (presets) => {
    const currentSig = getHanziSignature(parseHanziList(textarea.value));
    const defaultSig = getHanziSignature(parseHanziList(DEFAULT_HANZIS));
    if (currentSig === defaultSig) {
        activePresetId = "default";
        return;
    }
    const matched = presets.find((p) => getHanziSignature(p.hanzis) === currentSig);
    if (matched) activePresetId = matched.id;
    // no match — keep whatever was already selected
    if (!activePresetId) activePresetId = "default";
};

const applyPreset = (hanzis, presetId) => {
    chrome.storage.local.set({ hanzis, activePresetId: presetId });
};

const renderPresetBar = () => {
    const bar = document.getElementById("presetBar");
    loadPresets((presets) => {
        textarea.disabled = activePresetId === "default";
        bar.innerHTML = "";

        const defaultBtn = document.createElement("button");
        defaultBtn.className = "preset-btn preset-default" + (activePresetId === "default" ? " preset-active" : "");
        defaultBtn.textContent = "기본";
        defaultBtn.title = "기본 한자 목록 불러오기";
        defaultBtn.addEventListener("click", () => {
            const hanzis = parseHanziList(DEFAULT_HANZIS);
            textarea.value = hanzis.join(", ");
            activePresetId = "default";
            applyPreset(hanzis, "default");
            renderPresetBar();
            renderLastHanzi();
        });
        bar.appendChild(defaultBtn);

        presets.forEach((preset) => {
            const wrapper = document.createElement("span");
            wrapper.className = "preset-item" + (activePresetId === preset.id ? " preset-active" : "");

            const btn = document.createElement("button");
            btn.className = "preset-btn preset-name";
            btn.textContent = preset.name;
            btn.title = `${preset.hanzis.length}개 한자`;
            btn.addEventListener("click", () => {
                textarea.disabled = false;
                textarea.value = preset.hanzis.join(", ");
                activePresetId = preset.id;
                applyPreset(preset.hanzis, preset.id);
                renderPresetBar();
                renderLastHanzi();
            });

            const rename = document.createElement("button");
            rename.className = "preset-btn preset-rename";
            rename.textContent = "✏";
            rename.title = "이름 바꾸기";
            rename.addEventListener("click", () => {
                const newName = prompt("새 이름을 입력하세요:", preset.name);
                if (!newName || !newName.trim()) return;
                loadPresets((all) => {
                    savePresets(
                        all.map((p) => (p.id === preset.id ? { ...p, name: newName.trim() } : p)),
                        renderPresetBar
                    );
                });
            });

            const del = document.createElement("button");
            del.className = "preset-btn preset-delete";
            del.textContent = "×";
            del.title = "삭제";
            del.addEventListener("click", () => {
                if (!confirm(`"${preset.name}" 프리셋을 삭제하시겠습니까?`)) return;
                loadPresets((all) => {
                    savePresets(all.filter((p) => p.id !== preset.id), renderPresetBar);
                });
            });

            wrapper.appendChild(btn);
            wrapper.appendChild(rename);
            wrapper.appendChild(del);
            bar.appendChild(wrapper);
        });

        const addBtn = document.createElement("button");
        addBtn.className = "preset-btn preset-add";
        addBtn.textContent = "사용자 정의 +";
        addBtn.title = "현재 목록을 새 프리셋으로 저장";
        addBtn.addEventListener("click", () => {
            const hanzis = parseHanziList(textarea.value);
            if (hanzis.length === 0) {
                alert("저장할 한자가 없습니다.");
                return;
            }
            loadPresets((all) => {
                const newPreset = {
                    id: `custom_${Date.now()}`,
                    name: `사용자 정의${all.length + 1}`,
                    hanzis,
                };
                savePresets([...all, newPreset], () => {
                    activePresetId = newPreset.id;
                    applyPreset(newPreset.hanzis, newPreset.id);
                    renderPresetBar();
                    renderLastHanzi();
                });
            });
        });
        bar.appendChild(addBtn);
    });
};

let presetSyncTimer = null;
textarea.addEventListener("input", () => {
    clearTimeout(presetSyncTimer);
    presetSyncTimer = setTimeout(renderPresetBar, 300);
});

textarea.addEventListener("blur", () => {
    clearTimeout(presetSyncTimer);
    const hanzis = parseHanziList(textarea.value);
    if (hanzis.length === 0) return;
    applyPreset(hanzis, activePresetId);  // synchronous — safe if popup closes immediately
    if (activePresetId !== "default") {
        loadPresets((all) => {
            savePresets(
                all.map((p) => p.id === activePresetId ? { ...p, hanzis } : p),
                renderPresetBar
            );
        });
    } else {
        renderPresetBar();
    }
});

const HANZI_PATTERN = /\p{Script=Han}/gu;

const DEFAULT_HANZIS = "火 兄 韓 學 八 土 七 寸 靑 中 弟 長 一 日 人 二 月 外 王 五 十 室 水 小 先 西 生 三 山 四 北 父 白 民 門 木 母 萬 六 東 大 年 女 南 金 軍 國 九 校 敎 後 孝 活 話 海 漢 下 平 直 左 足 正 全 前 電 場 子 自 右 午 安 食 市 時 手 世 姓 上 事 不 方 物 名 每 立 力 動 道 答 農 內 男 氣 記 工 空 車 江 間 家 休 花 夏 便 出 春 秋 村 草 天 千 川 紙 地 重 主 住 祖 字 入 邑 育 有 然 語 心 植 數 少 所 夕 色 算 夫 百 問 文 命 面 林 里 老 來 登 同 洞 冬 旗 口 歌 會 和 形 現 幸 風 表 體 淸 窓 集 注 第 題 庭 戰 才 作 昨 意 音 飮 運 用 勇 業 弱 藥 新 信 身 神 始 術 消 成 省 雪 線 書 社 分 部 放 發 半 反 班 聞 明 利 理 樂 等 童 讀 圖 對 代 堂 短 急 今 球 光 果 科 共 公 功 高 界 計 角 各 訓 黃 畫 號 向 行 合 特 通 太 親 晝 族 朝 定 在 章 者 醫 衣 銀 由 油 遠 園 溫 英 永 言 洋 陽 夜 野 愛 失 式 勝 習 樹 孫 速 席 石 使 死 本 服 病 別 番 朴 美 米 目 李 綠 路 禮 例 頭 度 待 多 級 根 近 郡 區 交 古 苦 京 開 強 感 凶 效 化 害 筆 必 品 宅 充 責 參 着 質 知 週 州 種 卒 調 情 店 節 切 展 傳 典 的 財 材 任 以 偉 元 雲 雨 友 要 養 約 惡 兒 實 臣 識 順 宿 首 束 歲 洗 性 說 仙 鮮 商 相 産 仕 士 史 奉 福 兵 變 法 望 陸 流 類 勞 練 歷 旅 良 朗 獨 到 德 當 團 能 念 基 己 局 舊 具 廣 觀 關 過 課 告 敬 結 決 見 格 客 價 黑 患 湖 許 寒 河 敗 板 炭 卓 打 他 則 致 祝 最 初 鐵 唱 止 罪 終 操 停 赤 貯 爭 災 再 因 耳 位 院 願 原 雄 牛 浴 曜 完 屋 葉 熱 億 漁 魚 案 示 善 船 選 序 賞 査 思 寫 氷 鼻 費 比 倍 無 賣 買 亡 末 馬 料 令 領 量 冷 落 島 都 談 壇 吉 技 汽 期 給 規 貴 救 橋 曲 考 固 景 競 輕 建 件 健 擧 去 改 可 加 希 興 吸 回 確 貨 戶 好 呼 護 惠 協 血 賢 驗 虛 香 鄕 解 港 航 限 豊 票 暴 包 布 砲 波 破 退 統 態 快 侵 齒 置 治 測 取 忠 蟲 築 蓄 銃 總 請 處 創 察 次 眞 進 職 支 至 志 指 增 衆 準 竹 走 宗 尊 造 早 鳥 助 製 際 祭 制 除 提 濟 程 精 政 接 絶 田 敵 低 將 障 認 印 引 益 移 議 義 應 陰 恩 肉 爲 衛 員 圓 容 謠 往 玉 誤 藝 榮 演 煙 硏 逆 餘 如 羊 液 壓 暗 眼 深 申 息 是 試 詩 視 施 承 純 守 授 受 修 收 送 俗 續 笑 掃 素 勢 稅 細 誠 城 聲 盛 聖 星 設 狀 想 床 常 殺 舍 寺 師 謝 貧 非 悲 飛 備 佛 富 副 婦 府 復 保 寶 步 報 邊 壁 伐 罰 拜 背 配 訪 房 防 博 密 未 味 務 武 牧 毛 脈 滿 律 留 論 錄 列 連 麗 兩 羅 燈 得 豆 斗 銅 毒 督 導 隊 帶 黨 擔 達 單 檀 端 斷 努 怒 難 暖 起 器 禁 極 權 宮 究 句 求 官 故 係 經 境 警 慶 缺 潔 檢 個 康 講 監 減 假 街 喜 揮 厚 候 灰 況 歡 環 華 紅 婚 混 或 刑 顯 革 險 憲 核 抗 閑 恨 避 疲 標 爆 胞 閉 評 篇 判 派 鬪 投 痛 討 擇 探 脫 彈 歎 稱 寢 針 層 趣 就 縮 推 招 聽 廳 泉 冊 採 讚 差 陣 珍 盡 織 智 誌 持 證 酒 朱 周 座 從 鍾 存 組 潮 條 帝 靜 丁 整 占 點 折 專 錢 轉 積 籍 適 賊 績 底 腸 壯 帳 獎 張 裝 雜 殘 資 姉 姿 仁 異 依 疑 儀 隱 乳 儒 遊 遺 危 威 慰 圍 委 怨 援 源 郵 遇 優 豫 映 迎 營 燃 緣 延 鉛 域 易 與 嚴 樣 額 氏 崇 肅 叔 秀 松 頌 損 屬 舌 宣 象 傷 散 射 絲 私 辭 祕 批 碑 憤 粉 負 否 伏 複 普 辯 範 犯 妨 髮 拍 舞 墓 妙 模 鳴 勉 妹 離 輪 柳 龍 烈 慮 糧 略 覽 亂 卵 徒 逃 盜 段 納 機 寄 紀 奇 筋 勤 劇 均 歸 卷 券 勸 窮 屈 君 群 構 鑛 管 攻 孔 骨 困 穀 孤 庫 繼 系 階 鷄 季 戒 驚 傾 更 鏡 堅 犬 擊 激 儉 傑 巨 居 拒 據 降 甲 甘 敢 看 干 簡 刻 覺 暇 稀 戲 胸 橫 獲 劃 懷 悔 皇 荒 換 還 禍 洪 忽 魂 惑 豪 虎 胡 浩 慧 衡 脅 穴 懸 玄 獻 響 恒 項 陷 含 割 汗 鶴 賀 何 荷 畢 彼 被 皮 楓 捕 浦 肺 廢 弊 偏 片 編 版 透 吐 兔 澤 泰 殆 湯 塔 奪 浸 沈 漆 稚 恥 値 側 醉 吹 衝 畜 追 催 促 觸 礎 超 肖 滯 徹 哲 賤 遷 淺 踐 戚 尺 拓 妻 策 彩 債 菜 蒼 昌 倉 贊 錯 此 借 徵 執 秩 疾 鎭 震 辰 陳 振 池 之 枝 蒸 症 曾 憎 卽 仲 宙 奏 鑄 洲 柱 株 珠 坐 縱 租 兆 照 諸 齊 征 廷 亭 頂 井 淨 貞 漸 殿 笛 蹟 跡 摘 寂 抵 著 裁 栽 載 葬 臟 丈 莊 掌 粧 藏 暫 潛 刺 紫 慈 賃 壬 逸 忍 翼 已 淫 乙 潤 猶 幼 柔 維 悠 裕 誘 幽 謂 胃 僞 越 韻 偶 宇 愚 羽 憂 欲 慾 辱 緩 瓦 獄 悟 烏 譽 影 鹽 炎 染 悅 燕 宴 軟 沿 疫 驛 役 譯 亦 憶 抑 御 壤 讓 揚 若 哀 仰 央 巖 岸 顔 阿 牙 芽 亞 雅 我 雙 甚 審 愼 飾 侍 乘 僧 昇 拾 濕 襲 述 旬 巡 瞬 熟 淑 獸 帥 需 輸 壽 隨 垂 殊 愁 衰 刷 鎖 訟 訴 疏 燒 蘇 禪 旋 釋 惜 徐 恕 緖 署 索 塞 裳 詳 喪 尙 霜 桑 像 償 森 削 祀 斜 沙 司 詞 蛇 邪 妃 肥 卑 婢 拂 紛 奮 奔 腐 附 符 付 賦 簿 浮 扶 封 峯 鳳 逢 腹 覆 譜 補 丙 碧 凡 繁 伯 培 排 輩 芳 拔 盤 飯 般 迫 薄 微 尾 勿 紋 默 墨 貿 茂 蒙 夢 沒 睦 貌 謀 慕 銘 滅 眠 綿 免 盲 猛 盟 孟 麥 媒 梅 妄 晩 幕 莫 漠 麻 磨 臨 裏 吏 履 陵 隆 率 栗 倫 累 漏 樓 賴 雷 弄 祿 爐 露 靈 嶺 裂 聯 蓮 鍊 戀 曆 勵 涼 梁 廊 郞 浪 蘭 欄 絡 凍 突 刀 陶 桃 倒 途 渡 貸 臺 糖 唐 踏 淡 旦 丹 但 茶 泥 腦 奴 寧 耐 娘 諾 緊 祈 騎 企 其 畿 及 禽 錦 琴 克 菌 鬼 拳 弓 菊 拘 久 丘 巧 較 壞 怪 狂 館 慣 寬 貫 冠 寡 誇 供 貢 恐 恭 哭 谷 稿 姑 鼓 啓 溪 契 械 桂 徑 頃 耕 硬 兼 謙 訣 隔 劍 乾 距 蓋 槪 介 綱 剛 鋼 鑑 幹 刊 懇 肝 閣 脚 佳 架 携 輝 毁 侯 曉 丸 擴 穫 禾 弘 鴻 昏 毫 乎 互 兮 亨 螢 嫌 絃 縣 軒 享 奚 亥 該 巷 咸 旱 匹 漂 幅 抱 飽 幣 蔽 遍 貝 販 把 頗 播 罷 怠 貪 誕 濁 濯 托 妥 墮 枕 臭 逐 丑 醜 抽 聰 燭 抄 秒 逮 替 遞 晴 妾 尖 添 薦 斥 暢 慘 慙 捉 且 懲 姪 遲 只 贈 俊 遵 舟 佐 拙 弔 燥 堤 訂 蝶 竊 滴 宰 哉 墻 酌 爵 玆 恣 姻 寅 夷 而 矣 宜 凝 泣 吟 閏 唯 惟 酉 愈 違 緯 云 于 又 尤 庸 搖 腰 遙 畏 曰 臥 翁 擁 娛 嗚 汚 吾 傲 銳 泳 詠 閱 輿 汝 予 余 焉 於 楊 躍 也 耶 厄 涯 殃 押 謁 雁 岳 餓 尋 伸 晨 辛 矢 戌 脣 殉 循 孰 搜 睡 雖 須 遂 誰 囚 誦 粟 召 昭 騷 蔬 攝 涉 析 昔 敍 庶 誓 暑 逝 祥 嘗 朔 賜 斯 詐 捨 巳 似 聘 頻 賓 朋 崩 墳 赴 蜂 卜 屛 竝 辨 飜 煩 杯 倣 邦 傍 伴 叛 返 泊 蜜 敏 憫 迷 眉 戊 霧 卯 廟 苗 暮 侮 某 冒 募 冥 埋 忘 罔 茫 忙 漫 慢 隣 梨 屢 淚 了 僚 鹿 隷 零 獵 廉 劣 憐 諒 掠 濫 騰 屯 鈍 豚 敦 篤 塗 稻 跳 挑 畓 惱 乃 奈 那 飢 旣 豈 欺 棄 幾 忌 肯 謹 斤 僅 糾 叫 軌 厥 俱 苟 驅 懼 龜 狗 矯 郊 塊 愧 掛 郭 坤 枯 顧 癸 繫 庚 卿 竟 牽 肩 絹 遣 乞 慨 皆 渴 姦 却 噫 煕 姬 勳 喉 廻 滑 幻 靴 酷 濠 型 峽 弦 艦 翰 虐 鋪 怖 抛 坪 霸 颱 胎 託 琢 炊 衷 蹴 軸 趨 焦 哨 締 諜 撤 隻 悽 滄 彰 斬 札 刹 餐 遮 輯 窒 塵 診 津 旨 脂 准 駐 綜 彫 措 釣 劑 偵 艇 呈 沮 蠶 磁 雌 諮 妊 壹 刃 貳 融 尉 苑 鬱 傭 熔 妖 歪 穩 梧 預 厭 硯 孃 惹 礙 癌 握 腎 紳 殖 屍 升 盾 紹 貰 纖 繕 碩 瑞 箱 揷 蔘 傘 酸 赦 唆 飼 匪 弗 敷 膚 俸 縫 倂 僻 汎 閥 柏 俳 賠 紡 搬 舶 紊 沐 矛 帽 蔑 魅 枚 網 蠻 灣 娩 膜 痲 摩 魔 硫 謬 療 籠 煉 輛 拉 藍 爛 洛 裸 謄 藤 桐 棟 悼 垈 戴 膽 潭 鍛 溺 尼 尿 濃 棋 閨 闕 圈 掘 窟 購 歐 鷗 膠 絞 僑 傀 款 戈 瓜 菓 雇 憩 揭 坑 憾 葛 嬉 熹 羲 禧 憙 欽 匈 烋 徽 薰 壎 熏 后 檜 淮 晃 滉 煥 桓 嬅 樺 泓 皓 鎬 壕 昊 祜 晧 扈 澔 邢 炯 瑩 瀅 馨 陜 鉉 炫 峴 赫 爀 杏 亢 沆 邯 弼 杓 葡 鮑 扁 彭 阪 坡 台 兌 耽 灘 峙 雉 聚 沖 椿 鄒 楸 崔 蜀 楚 瞻 喆 澈 釧 陟 采 蔡 埰 昶 敞 瓚 璨 燦 鑽 晋 秦 稷 稙 址 芝 駿 晙 峻 埈 濬 浚 疇 琮 曺 祚 趙 珽 鼎 禎 汀 晶 鄭 旌 楨 甸 璋 庄 蔣 獐 滋 佾 鎰 翊 伊 怡 珥 鷹 誾 垠 殷 鈗 胤 尹 允 兪 楡 踰 庾 魏 渭 韋 袁 瑗 媛 熊 蔚 芸 昱 旭 郁 頊 煜 禹 祐 佑 瑢 鏞 鎔 溶 堯 姚 耀 倭 旺 汪 莞 雍 邕 甕 鈺 沃 吳 墺 濊 睿 芮 盈 瑛 暎 燁 閻 淵 衍 姸 彦 襄 倻 埃 艾 鴨 閼 瀋 軾 湜 柴 繩 瑟 荀 洵 珣 舜 淳 銖 隋 洙 宋 巢 沼 邵 晟 燮 暹 陝 蟾 薛 卨 璇 瑄 璿 奭 錫 晳 舒 庠 泗 馮 彬 丕 毖 泌 毘 鵬 芬 阜 傅 釜 蓬 馥 甫 潽 輔 秉 柄 炳 昞 昺 卞 弁 范 筏 裵 龐 旁 鉢 渤 潘 磻 旼 旻 珉 玟 閔 彌 汶 昴 穆 牟 茅 謨 俛 沔 冕 覓 貊 靺 麟 楞 崙 劉 遼 鷺 盧 魯 蘆 醴 玲 濂 漣 礪 呂 廬 驪 亮 樑 萊 鄧 杜 董 乭 頓 燉 惇 燾 悳 塘 湍 箕 驥 騏 琦 琪 璣 冀 淇 沂 耆 麒 岐 兢 瑾 槿 珪 揆 圭 奎 鞠 玖 邱 槐 琯 串 皐 璟 炅 瓊 儆 甄 桀 杰 鍵 价 塏 疆 崗 姜 岡 彊 岬 鉀 鞨 杆 艮 珏 伽 軻 賈 迦 柯 詰 犧 洽 恰 歆 欠 痕 欣 兇 洶 恤 諱 彙 麾 卉 喙 喧 暈 吼 朽 嗅 逅 嚆 哮 酵 爻 蛔 膾 賄 徊 恢 晦 繪 誨 恍 徨 慌 煌 凰 惶 遑 闊 猾 鰥 喚 宦 驩 訌 虹 哄 惚 笏 渾 弧 琥 糊 狐 瑚 醯 彗 荊 狹 俠 頰 挾 衒 眩 絢 歇 墟 噓 饗 嚮 劾 諧 偕 邂 骸 楷 駭 咳 懈 缸 肛 盒 蛤 函 鹹 涵 銜 喊 緘 檻 轄 悍 澣 罕 謔 瘧 壑 瑕 遐 蝦 霞 逼 乏 疋 披 諷 稟 豹 飄 慓 剽 瀑 曝 脯 圃 庖 蒲 疱 哺 袍 逋 匍 褒 咆 泡 斃 陛 萍 貶 鞭 騙 愎 膨 澎 稗 牌 佩 唄 沛 悖 辦 婆 芭 跛 琶 巴 爬 慝 套 妬 堆 褪 頹 腿 筒 桶 慟 攄 撐 汰 苔 笞 跆 宕 蕩 搭 眈 坦 綻 呑 憚 擢 鐸 舵 唾 陀 駝 楕 惰 秤 蟄 鍼 砧 勅 痔 癡 熾 侈 緻 嗤 馳 幟 惻 翠 娶 脆 贅 悴 膵 萃 黜 槌 樞 錘 酋 椎 鎚 錐 鰍 墜 芻 撮 寵 塚 叢 忖 囑 硝 蕉 憔 醋 稍 礁 炒 貂 樵 梢 諦 涕 牒 捷 貼 帖 疊 籤 諂 僉 綴 凸 轍 喘 闡 擅 穿 瘠 滌 脊 擲 凄 柵 寨 菖 娼 槍 愴 脹 瘡 艙 猖 漲 倡 廠 讒 僭 讖 站 懺 塹 擦 撰 篡 饌 纂 搾 窄 鑿 嗟 蹉 叉 澄 斟 朕 帙 桎 膣 嫉 叱 跌 迭 嗔 疹 肢 枳 摯 咫 祉 汁 葺 櫛 樽 竣 蠢 做 紂 胄 呪 嗾 廚 誅 輳 紬 躊 註 挫 腫 踪 踵 慫 猝 簇 糟 詔 躁 凋 爪 稠 嘲 肇 眺 漕 曹 遭 阻 藻 棗 槽 繰 粗 啼 梯 蹄 悌 穽 靖 酊 挺 町 釘 錠 碇 睛 幀 霑 粘 截 奠 篆 顚 纏 澱 箭 銓 餞 癲 塡 栓 顫 輾 氈 煎 箋 悛 剪 廛 嫡 迹 狄 謫 邸 箸 詛 狙 咀 觝 躇 豬 錚 滓 齋 杖 漿 匠 薔 醬 仗 檣 簪 箴 盞 棧 芍 炸 雀 嚼 灼 綽 鵲 勺 疵 仔 煮 蔗 瓷 藉 炙 孕 剩 佚 溢 靭 蚓 湮 咽 翌 姨 痍 餌 弛 爾 誼 椅 擬 毅 膺 揖 蔭 戎 絨 游 諭 愉 柚 揄 諛 癒 蹂 鍮 宥 喩 萎 冤 鴛 猿 殞 隕 耘 虞 迂 嵎 寓 隅 茸 蓉 聳 涌 踊 夭 拗 僥 凹 擾 邀 饒 窯 窈 猥 巍 矮 枉 腕 玩 宛 頑 婉 阮 渦 蝸 訛 壅 蘊 懊 寤 伍 奧 裔 詣 穢 曳 嬰 焰 艶 鳶 椽 捐 筵 繹 儼 奄 掩 諺 堰 臆 圄 瘀 禦 瘍 釀 恙 攘 癢 葯 冶 揶 爺 櫻 鶯 扼 縊 腋 曖 隘 崖 靄 鴦 怏 秧 昂 庵 闇 軋 斡 鞍 晏 按 堊 顎 愕 訝 俄 啞 衙 什 悉 蜃 呻 娠 薪 迅 燼 訊 宸 蝕 拭 熄 弑 諡 媤 猜 豺 匙 柿 丞 膝 筍 醇 馴 菽 夙 塾 嫂 穗 讎 瘦 粹 戍 繡 袖 竪 狩 髓 羞 蒐 酬 灑 碎 悚 遜 贖 塑 瘙 簫 梳 蕭 疎 宵 逍 甦 搔 遡 醒 閃 殲 渫 泄 洩 屑 膳 腺 煽 扇 羨 銑 潟 抒 鼠 嶼 胥 曙 壻 犀 棲 黍 薯 牲 甥 嗇 璽 孀 觴 爽 翔 澁 滲 煞 撒 薩 珊 疝 刪 娑 些 嗣 徙 瀉 麝 奢 獅 祠 紗 蓑 憑 嚬 殯 瀕 濱 嬪 誹 臂 秕 脾 妣 痺 扉 琵 譬 匕 砒 緋 蜚 翡 裨 庇 鄙 沸 憊 棚 硼 繃 彿 忿 噴 焚 吩 糞 盆 雰 扮 剖 腑 芙 孵 咐 賻 駙 埠 訃 斧 俯 鋒 烽 捧 棒 僕 鰒 輻 匐 堡 菩 洑 甁 餠 鼈 瞥 劈 闢 擘 癖 璧 梵 泛 帆 氾 藩 蕃 帛 魄 徘 胚 湃 陪 彷 謗 膀 尨 榜 昉 坊 幇 枋 肪 醱 跋 潑 撥 勃 魃 槃 絆 斑 蟠 拌 礬 畔 攀 頒 珀 膊 撲 粕 縛 樸 剝 箔 搏 駁 謐 悶 薇 媚 靡 蚊 畝 拇 憮 撫 誣 巫 毋 蕪 渺 杳 描 猫 歿 牡 耗 糢 摸 袂 暝 酩 溟 螟 皿 棉 緬 麪 眄 萌 寐 呆 昧 罵 煤 邁 惘 芒 抹 襪 沫 瞞 鰻 饅 卍 蔓 挽 輓 彎 寞 笠 粒 淋 躪 吝 鱗 燐 痢 籬 悧 俚 裡 釐 罹 凌 綾 稜 菱 凜 勒 肋 慄 淪 綸 戮 瘤 溜 琉 壘 陋 燎 聊 寥 瞭 寮 牢 磊 賂 儡 瓏 壟 聾 碌 麓 虜 擄 撈 逞 囹 鈴 齡 殮 簾 斂 輦 礫 瀝 侶 戾 閭 黎 濾 倆 粱 狼 臘 蠟 籃 剌 辣 瀾 鸞 烙 酪 駱 邏 螺 癩 懶 橙 遁 臀 兜 痘 胴 疼 憧 瞳 沌 瀆 禿 掉 萄 搗 屠 淘 禱 睹 蹈 滔 濤 鍍 堵 賭 袋 擡 撞 棠 螳 遝 曇 譚 憺 澹 痰 疸 撻 簞 蛋 緞 匿 紐 訥 撓 膿 弩 駑 涅 撚 囊 衲 捺 捏 煖 儺 拿 拏 懦 喫 拮 崎 嗜 伎 肌 譏 綺 畸 朞 妓 羈 杞 矜 亘 汲 扱 衾 襟 擒 饉 覲 隙 戟 剋 棘 橘 窺 葵 逵 硅 机 几 詭 潰 櫃 蹶 眷 倦 捲 穹 躬 窘 嶇 臼 仇 舅 鳩 軀 矩 駒 廏 灸 毆 垢 寇 溝 謳 衢 柩 枸 嘔 鉤 攪 嬌 咬 皎 喬 狡 驕 蛟 轎 肱 宏 轟 拐 乖 魁 罫 卦 胱 曠 匡 壙 括 刮 灌 棺 顴 藿 槨 廓 顆 拱 鞏 汨 棍 昆 袞 梏 鵠 辜 拷 呱 袴 錮 叩 敲 股 膏 痼 悸 梗 莖 脛 頸 憬 勁 鯨 磬 痙 鵑 譴 繭 覡 檄 膈 偈 劫 怯 腱 巾 虔 醵 倨 渠 羹 愾 漑 箇 芥 凱 慷 腔 薑 糠 閘 匣 勘 柑 瞰 堪 疳 紺 竭 喝 褐 艱 澗 竿 墾 諫 癎 奸 揀 恪 殼 嘉 稼 嫁 哥 駕 呵 苛 袈 凞 曦 僖 囍 熺 晞 戱 憘 翕 紇 訖 屹 吃 炘 昕 譎 鷸 虧 畦 暉 煇 萱 煊 暄 薨 焄 塤 燻 勛 珝 煦 帿 梟 肴 涍 淆 驍 斅 鐄 宖 茴 澮 匯 獪 幌 蝗 隍 璜 榥 潢 湟 簧 晄 愰 篁 豁 紈 奐 晥 渙 攫 碻 譁 畵 汞 烘 琿 縞 濩 顥 岵 芦 壺 瓠 灝 葫 滸 淏 蒿 蝴 頀 蹊 鞋 暳 蕙 珩 鎣 滎 灐 烱 逈 泂 熒 莢 浹 夾 脇 鋏 孑 頁 晛 玹 俔 舷 睍 泫 奕 櫶 珦 餉 倖 荇 瀣 孩 垓 蟹 姮 嫦 桁 杭 伉 閤 闔 哈 啣 閒 瀚 厦 廈 昰 鰕 馝 苾 珌 陂 瓢 飇 彪 驃 俵 佈 匏 苞 吠 嬖 枰 翩 烹 狽 覇 浿 叭 捌 坂 瓣 鈑 杷 擺 闖 偸 兎 撑 邰 帑 榻 嘆 坼 倬 啄 柝 琸 晫 馱 拖 咤 朶 琛 柒 飭 梔 輜 穉 痴 蚩 緇 淄 厠 仄 驟 嘴 鷲 朮 瑃 竺 蹙 筑 皺 雛 騶 萩 湫 諏 蔥 憁 悤 摠 邨 矗 艸 醮 酢 苕 椒 剿 剃 鯖 菁 睫 堞 輒 沾 簽 詹 甛 輟 仟 玔 舛 阡 韆 倜 剔 蹠 慽 寀 綵 釵 砦 紮 纘 粲 簒 澯 竄 齪 侘 嵯 箚 磋 鏶 潗 侄 瓆 蛭 袗 桭 賑 臻 璡 瑨 軫 晉 蔯 瞋 畛 縝 溱 唇 殄 縉 搢 榛 贄 漬 砥 趾 沚 芷 祗 蜘 烝 甑 繒 拯 楫 緝 茁 儁 雋 焌 逡 寯 畯 粥 冑 酎 姝 炷 籌 綢 湊 澍 侏 蛛 悰 棕 倧 鐘 淙 鏃 吊 晁 雕 蚤 璪 俎 窕 醍 臍 薺 霽 鉦 諪 綎 玎 淀 鋌 炡 霆 湞 渟 瀞 晸 姃 檉 摺 点 鮎 岾 癤 浙 畑 筌 琠 佺 鐫 鈿 塼 佃 詮 鏑 荻 迪 翟 勣 疽 齟 這 佇 儲 雎 渚 紵 苧 姐 猪 楮 菹 杵 藷 樗 箏 諍 縡 渽 齎 梓 暲 臧 贓 欌 牆 樟 岑 孱 潺 斫 咨 孜 茨 仍 芿 卄 稔 姙 恁 荏 馹 茵 絪 靷 謚 瀷 荑 貽 肄 苡 飴 彛 邇 薏 懿 艤 倚 蟻 慇 瀜 聿 贇 奫 玧 毓 堉 侑 楢 濡 臾 釉 孺 瑜 攸 萸 洧 逾 猷 褘 瑋 蔿 暐 蝟 葦 鉞 爰 寃 嫄 愿 湲 洹 沅 円 垣 轅 亐 蕓 澐 熉 橒 勖 彧 稶 栯 旴 芋 瑀 玗 藕 紆 禑 釪 盂 雩 俑 冗 甬 湧 墉 榕 埇 慂 縟 褥 蟯 瑤 繇 燿 繞 嶢 橈 嵬 娃 琬 脘 椀 碗 豌 浣 琓 翫 窪 窩 蛙 癰 饔 瓮 兀 瘟 瑥 縕 蜈 鼇 鰲 塢 獒 熬 筽 旿 晤 澳 俉 敖 倪 霓 猊 刈 叡 汭 蘂 乂 霙 穎 瓔 嶸 煐 鍈 瀛 濚 潁 渶 瀯 塋 楹 纓 曄 苒 琰 剡 髥 嚥 涎 涓 娟 烟 堧 沇 挻 縯 璵 歟 轝 艅 礖 茹 嶪 淹 俺 蘖 孼 偃 檍 齬 馭 暘 禳 穰 瀁 煬 敭 佯 痒 蒻 椰 罌 鸚 掖 厓 碍 昻 狎 唵 菴 岩 鮟 嶽 鍔 幄 齷 鰐 渥 鄂 娥 峨 莪 蛾 鵝 鴉 沁 諶 芯 藎 莘 侁 埴 寔 篒 尸 蓍 恃 蒔 嘶 屎 豕 翅 蠅 陞 褶 蝨 崧 嵩 鉥 錞 蓴 徇 恂 詢 橓 蕣 楯 栒 諄 琡 璹 潚 綏 璲 綬 讐 琇 漱 藪 茱 鬚 蓚 銹 峀 岫 燧 邃 脩 隧 嗽 釗 淞 蓀 巽 飡 謖 涑 嘯 韶 篠 銷 炤 瀟 溯 笹 珹 猩 宬 腥 筬 惺 贍 楔 褻 齧 僊 蘚 琁 敾 癬 饍 渲 跣 蟬 詵 鐥 嬋 蓆 汐 淅 鋤 筮 絮 墅 栖 捿 笙 穡 賽 牀 橡 湘 峠 廂 鈒 颯 芟 衫 杉 乷 汕 霰 蒜 篩 渣 乍 僿 伺 柶 莎 駟 梭 肆 砂 俟 裟 騁 玭 牝 斌 檳 浜 粃 菲 斐 秘 枇 榧 毗 昐 賁 汾 缶 孚 鳧 溥 艀 莩 趺 琫 峰 熢 乶 宓 茯 輹 蔔 褓 湺 珤 棅 幷 輧 鱉 騈 檗 蘗 霹 琺 樊 幡 燔 栢 佰 盃 裴 焙 褙 蚌 蒡 舫 滂 磅 瘢 泮 盼 磐 雹 璞 愍 岷 泯 緡 楣 謎 嵋 渼 湄 梶 黴 沕 吻 們 刎 雯 懋 珷 无 繆 鵡 楙 竗 錨 朦 鶩 姆 摹 瑁 眸 芼 椧 茗 蓂 瞑 麵 冪 氓 陌 驀 莽 邙 輞 茉 唜 万 巒 曼 邈 瑪 碼 砬 霖 琳 璘 潾 藺 浬 鯉 璃 羸 唎 狸 莉 厘 侖 瑠 榴 瀏 旒 縷 鏤 瘻 蔞 褸 婁 蓼 廖 賚 瀨 瀧 朧 菉 輅 潞 瀘 櫓 鹵 澧 羚 怜 伶 岺 聆 笭 翎 冽 洌 璉 攣 轢 靂 儷 櫚 犁 藜 驢 蠣 粮 凉 徠 崍 琅 螂 瑯 擥 攬 嵐 纜 襤 欖 欒 珞 蘿 喇 嶝 芚 荳 枓 逗 竇 仝 潼 暾 焞 旽 墩 遯 牘 犢 纛 嶋 櫂 覩 棹 韜 岱 坮 玳 黛 戇 幢 沓 錟 蕁 湛 啖 坍 覃 聃 獺 澾 鄲 彖 亶 袒 杻 嫩 鬧 瑙 寗 獰 恬 拈 捻 秊 柰 湳 枏 楠 娜 佶 桔 錤 璂 玘 祁 祇 饑 夔 磯 錡 耭 碁 祺 圻 埼 伋 芩 妗 衿 昑 檎 劤 懃 菫 芹 畇 鈞 筠 勻 赳 槻 竅 晷 饋 獗 蕨 淃 芎 堀 裙 麴 鞫 咎 逑 毬 坵 廐 耈 瞿 柾 銶 絿 勾 翹 鮫 嶠 蕎 餃 紘 珖 侊 炚 洸 筐 适 恝 菅 瓘 罐 梡 鍋 跨 珙 蚣 控 琨 崑 梱 滾 鯤 斛 藁 菰 苽 羔 攷 沽 睾 暠 槁 蠱 尻 誥 堺 棨 屆 谿 磎 稽 誡 俓 璥 耿 暻 擎 涇 坰 絅 逕 勍 倞 鉗 箝 慊 鎌 抉 迲 劒 鈐 瞼 黔 愆 蹇 騫 楗 炬 鉅 鋸 据 祛 遽 踞 粳 喀 愷 疥 盖 鎧 襁 絳 畺 羌 鱇 舡 堈 强 胛 戡 嵌 坎 鑒 龕 橄 蝎 曷 碣 乫 磵 稈 桿 侃 柬 慤 痂 枷 跏 珂 訶 茄 襭 嘻 饎 咥 餼 豨 橲 潝 迄 齕 仡 汔 釁 忻 訩 遹 咻 觿 睢 攜 翬 虺 諠 咺 諼 貆 纁 鑂 鍭 酗 詡 餱 殽 鴞 傚 効 虓 囂 嘵 擭 薈 頮 洄 堭 喤 媓 濶 芄 睆 鍰 圜 逭 懽 豢 鐶 雘 矍 鬨 鉷 洚 惛 皜 嘑 皥 怙 薅 譓 憓 嘒 盻 傒 徯 冾 恊 絜 昡 怰 儇 嬛 莧 鞙 駽 衋 洫 焃 虩 侐 玁 獫 巘 栩 悻 覈 醢 陔 頏 柙 嗑 盍 諴 菡 鬫 劼 舝 哻 扞 熯 暵 僩 翯 菏 嘏 芐 騢 呀 偪 觱 鉍 佖 飶 鞸 怭 駜 詖 豐 灃 飆 摽 鑣 嘌 滮 儦 瀌 殍 餔 炮 襃 炰 麃 敝 苹 褊 徧 諞 祊 伻 茷 粺 孛 旆 昄 豝 嶓 皤 簸 忒 渝 魋 蓷 隤 恫 瓲 畽 噸 啍 噋 迨 駾 簜 盪 蝪 漯 醓 嗿 梲 嘽 疃 驒 僤 殫 椓 橐 蘀 紽 佗 鼉 嶞 沱 鮀 它 噲 夬 縶 忱 寑 綅 駸 哆 褫 庤 觶 鴟 懥 懫 菑 寘 絺 昃 廁 毳 揣 瘁 惴 虫 忡 珫 怵 杶 賰 蓫 顣 蹜 柷 踧 妯 騅 縐 萑 甃 緅 鵻 瘳 鶖 棸 蝤 鄹 麤 嘬 凗 摧 冢 潨 躅 蠋 勦 譙 誚 悄 禘 嚔 棣 揥 蝃 髢 彘 杕 掣 疐 遆 餂 忝 覘 襜 啜 掇 歠 惙 驖 幝 俴 倩 遄 梴 坧 蹐 跖 蹢 惕 慼 萋 簀 瘵 瘥 蠆 韔 鬯 蹌 窗 鶬 瑲 悵 搶 譖 毚 憯 扎 爨 湌 巑 斮 斲 佌 瑳 泚 佽 銍 礩 絰 瓞 挃 耋 蒺 垤 蓁 螓 鬒 紾 禛 瑱 篪 輊 鋕 坻 踟 蚳 璔 濈 戢 騭 崒 噂 鱒 隼 埻 蹲 鬻 幬 裯 妵 霔 輈 譸 咮 躕 燽 馵 邾 遒 侜 脞 瑽 椶 樅 蹤 尰 鬷 螽 豵 鰷 殂 鼂 洮 蓧 竈 蜩 阼 慥 蔦 旐 懆 螬 鞗 恌 佻 皁 皂 徂 罩 禔 娣 瑅 躋 隮 懠 鵜 穧 泲 嚌 隄 蠐 稊 阱 桯 鋥 裎 珵 酲 赬 涏 棖 梃 靚 坫 玷 墊 簟 晣 晢 牷 荃 飦 鱣 翦 顓 瘨 闐 巓 畋 靦 瀍 邅 腆 戩 旃 踖 糴 覿 逖 趯 籊 罝 筯 苴 疷 羝 羜 杼 砠 氐 灾 纔 賫 奘 戕 鏘 粻 牂 萇 漳 斨 僝 柞 訾 訿 鎡 茲 秭 貲 鼒 粢 孶 赭 耔 胏 柘 胾 陾 衽 袵 泆 駰 禋 闉 軔 訒 陻 仞 夤 牣 弋 頤 洟 苢 詒 訑 樲 彝 迤 杝 异 刵 桋 劓 薿 猗 扆 饐 浥 挹 訔 嚚 溵 憖 檼 驈 鴥 汩 繘 狁 阭 揉 帷 槱 曘 窬 羑 褎 卣 醹 鮪 楰 呦 籲 龥 滺 濰 囿 牖 秞 黝 緌 輶 莠 喟 藯 煒 韡 闈 刖 軏 黿 騵 菀 篔 沄 勗 稢 薁 燠 踽 訧 吁 俁 耦 麀 麌 訏 噳 堣 盱 楀 懮 耰 宂 踴 鄘 殀 鷕 葽 喓 蕘 徼 徭 騧 垸 婠 盌 吪 雝 顒 灉 廱 卼 扤 杌 媼 昷 醞 慍 韞 鋈 杇 珸 嗸 汙 忤 奡 隩 睨 蓺 勩 堄 麑 羿 瘞 蚋 輗 橤 蕊 鷖 翳 攖 咏 縈 郢 贏 嬴 爗 饁 饜 檿 燄 焱 冉 艷 噎 醼 掾 悁 蜎 兗 緎 晹 鷊 埸 嶧 淢 罭 閾 棫 懌 鶂 畬 洳 旟 鸒 渰 閹 揜 臲 孽 臬 唁 鰋 嶷 飫 饇 敔 圉 瀼 昜 漾 鍚 颺 饟 籥 禴 瀹 嚶 戹 頟 阨 藹 僾 餲 泱 盎 卬 鞅 黯 頞 戛 揠 歹 遏 訐 犴 鴈 咢 迓 葚 諗 蟋 矧 哂 璶 甡 駪 贐 栻 偲 塒 兕 緦 釃 枲 啻 鳲 諟 隰 熠 璱 犉 漘 鶉 郇 肫 俶 橚 售 殳 廋 瞍 豎 檖 穟 睟 魗 濉 叟 繻 瑣 洒 竦 蟀 飧 飱 蔌 樕 藚 餗 觫 愬 霄 愫 玿 埽 慅 翛 柖 繅 艘 蠨 蛸 帨 瑆 娍 騂 韘 憸 暬 絏 偰 挈 紲 墡 毨 墠 珗 愃 僎 腊 螫 舃 裼 鼫 鉐 湑 鱮 藇 噬 諝 婿 澨 紓 癙 眚 鱨 顙 殤 塽 歃 潸 鑠 傞 蹝 榭 笥 糸 鯊 涘 戺 耜 簑 蓰 汜 葸 蠙 儐 璸 繽 鬢 擯 蘋 豳 邠 伾 駓 俾 朏 畀 痹 腓 奰 岯 悱 剕 淠 圮 貔 鞞 仳 棐 埤 篚 閟 霏 庳 紕 羆 轡 騑 秠 紱 紼 茀 咈 芾 黻 巿 笰 艴 枌 鼖 饙 幩 苯 蕡 棼 豶 濆 掊 祔 蜉 芣 鈇 紑 拊 痡 俘 鮒 裒 罦 桴 菶 芃 唪 丰 葑 扑 葍 鍑 楅 濮 黼 鴇 迸 荓 缾 怲 籩 釆 甓 辟 杋 蘩 袢 墦 翻 桮 厖 魴 逄 幫 雱 茇 浡 軷 胖 鞶 鎛 襮 亳 鉑 忞 敃 黽 慜 痻 潣 暋 亹 弭 糜 敉 瀰 郿 麋 捫 璊 穈 炆 纆 廡 儛 膴 髳 眇 茆 貓 濛 矇 饛 幪 楘 霂 蟊 旄 麰 髦 耄 眊 幭 篾 湎 貉 霢 勱 沬 霾 鋂 痗 苺 脢 浼 韎 蘉 秣 墁 鏋 瘼 藐 禡 苙 鄰 粼 涖 莅 俐 縭 梩 纚 离 詈 廩 懍 僇 穋 罶 駵 藟 虆 懰 纍 摟 潦 繚 敹 罍 耒 隴 彔 纑 簵 壚 鱧 昤 姈 苓 蛉 蘞 栵 孌 鬲 櫟 酈 蠡 厲 膂 藘 騋 勑 倈 稂 捋 瓓 闌 雒 臝 蠃 滕 螣 縢 斁 侗 僮 罿 彤 蝀 烔 匵 黷 櫝 叨 稌 擣 鼗 謟 咷 瘏 荼 鞉 闍 檮 綯 翿 慆 忉 祋 憝 懟 譈 鏜 螗 鐺 倘 儻 驔 萏 惔 餤 髧 菼 耼 窞 黮 怛 闥 漙 襢 癉 煅 慱 爹 昵 怩 你 柅 鈕 忸 狃 耨 餒 穠 呶 孥 猱 怓 峱 砮 甯 佞 鼐 迺 曩 軜 陧 赧 戁 姞 芑 墍 頎 蘷 跂 旂 軝 忮 僛 暣 棊 屺 曁 綦 歧 掎 羇 覊 亙 岌 墐 漌 郤 襋 亟 殛 箘 麕 樛 戣 刲 闚 睽 糺 頍 騤 頄 宄 簋 匭 簣 垝 餽 跪 氿 匱 綣 鬈 睠 棬 詘 匊 捄 彀 嫗 笱 雊 璆 疚 搆 屨 劬 觩 韭 艽 糗 漚 遘 姤 覯 扣 俅 媾 裘 窶 磽 佼 姣 曒 蹻 敽 茭 荍 鷮 嘐 儌 觥 鞃 虢 蕢 瑰 誑 迋 桄 纊 栝 佸 聒 鸛 綰 瘝 丱 錧 痯 盥 祼 躩 霍 鞹 裹 夸 薖 蜾 悾 邛 鯀 錕 棞 髡 緄 牿 轂 觳 鼛 罛 櫜 盬 稾 羖 觚 瞽 栲 杲 熇 槀 酤 翶 罟 楛 刳 烓 笄 雞 褧 黥 煢 焭 牼 駉 冏 熲 冂 檠 罄 睘 鶊 惸 歉 蒹 袺 觼 闋 睊 岍 畎 獧 豣 蠲 繾 狷 繳 鴃 鵙 綌 愒 跲 朅 褰 琚 蘧 虡 袪 籧 椐 莒 筥 秬 臄 賡 秔 硜 鏗 槩 嘅 玠 喈 湝 橿 杠 矙 酣 欿 歛 减 秸 衎 榦 玕 瞯 蕑 桷 卻 斝 珈 葭 哿 檟";

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
    chrome.storage.local.get({ hanzis: [], activePresetId: null }, (data) => {
        if (Array.isArray(data.hanzis) && data.hanzis.length > 0) {
            textarea.value = data.hanzis.join(", ");
        } else {
            const defaultList = parseHanziList(DEFAULT_HANZIS);
            chrome.storage.local.set({ hanzis: defaultList });
            textarea.value = defaultList.join(", ");
        }
        loadPresets((presets) => {
            if (data.activePresetId) {
                const valid = data.activePresetId === "default"
                    || presets.some((p) => p.id === data.activePresetId);
                activePresetId = valid ? data.activePresetId : null;
            }
            if (!activePresetId) syncActivePreset(presets);
            renderPresetBar();
            renderLastHanzi();
        });
    });
};

const renderLastHanzi = () => {
    chrome.storage.local.get({ lastHanziMap: {} }, (data) => {
        const entry = (data.lastHanziMap || {})[activePresetId];
        if (entry && entry.hanzi) {
            lastHanziInfo.textContent = `마지막 학습: ${entry.hanzi}`;
        } else {
            lastHanziInfo.textContent = "아직 방문한 한자가 없습니다.";
        }
    });
};

goToLastHanziButton.addEventListener("click", () => {
    chrome.storage.local.get({ lastHanziMap: {} }, (data) => {
        const entry = (data.lastHanziMap || {})[activePresetId];
        if (!entry || (!entry.url && !entry.hanzi)) {
            alert("아직 방문한 한자가 없습니다. 먼저 한자 상세 페이지를 방문하세요.");
            return;
        }
        const url = entry.url || `https://hanja.dict.naver.com/#/search?query=${encodeURIComponent(entry.hanzi)}`;
        chrome.tabs.create({ url });
    });
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSavedHanzis, { once: true });
} else {
    renderSavedHanzis();
}
