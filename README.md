## 專案介紹

此專案為 Tampermonkey 使用者指令碼 (UserScript) 集合，用於將 AI 對話頁面的內容匯出為 Markdown。
支援的平台：

| 指令碼 | 對應網站 | 功能 |
| --- | --- | --- |
| [`scripts/claude.ai.js`](scripts/claude.ai.js) | https://claude.ai/ | 下載完整對話或僅問 / 僅答為 `.md` 檔 / 複製到剪貼簿 |
| [`scripts/gemini.js`](scripts/gemini.js) | https://gemini.google.com/ | 下載完整對話或僅問 / 僅答為 `.md` 檔 / 複製到剪貼簿 |

兩個指令碼均會在頁面右下角注入一個浮動面板，提供「下載」與「複製」按鈕。


## 安裝方式

### 1. 安裝 Tampermonkey 瀏覽器擴充功能

 參考: https://www.tampermonkey.net/

 - Chrome: https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo
 - Edge: https://microsoftedge.microsoft.com/addons/detail/%E7%AF%A1%E6%94%B9%E7%8C%B4/iikmkjmpaadaobahmlepeloendndfphd
 - Safari-付費版: https://apps.apple.com/us/app/tampermonkey/id6738342400
 - Safari-直接安裝: https://data.tampermonkey.net/tampermonkey_latest.safariextz


### 2. 啟用開發者 / 使用者指令碼模式

 啟動方式 (Chrome, Edge):
  1. 開啟 `chrome://extensions` (Edge 為 `edge://extensions`)，啟用「開發人員模式」
  2. Tampermonkey extension → 詳細資料 → 允許使用者指令碼

 其他瀏覽器:
  TBD


### 3. 安裝本專案的指令碼

 1. 開啟 Tampermonkey 儀表板 → 「新增指令碼」
 2. 將 `scripts/` 目錄下對應的 `.js` 檔案整份內容貼上
 3. 儲存 (Ctrl + S)
 4. 前往對應網站 (claude.ai 或 gemini.google.com)，右下角應出現浮動面板


## 使用方式

 進入對話頁面後，等待內容載入完成，點擊浮動面板上的按鈕：
  - **下載**：將對話存成 Markdown 檔案 (檔名格式 `[source][YYYYMMDD]title.md`)
  - **複製**：將 Markdown 內容複製到剪貼簿

 面板上的下拉選單可選擇輸出範圍：完整對話 (Q&A) / 僅提問 (User) / 僅回答 (AI)。
