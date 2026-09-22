# 角色卡片 RWD 修復｜2026-09-22

- 狀態：Done；frontend / ui / web / medium / standard。
- 範圍：使用者管理頁的角色與權限區塊。恢復 RWD 可見性、零使用者的灰色 avatar，以及卡片橫向溢位時的左右捲動控制。
- 非範圍：角色資料、權限規則、後端 API、其他管理頁與發佈。
- 假設：左右控制只在仍可向該方向移動時顯示；滑鼠、觸控與鍵盤仍可使用原生水平捲動區。

| 驗收條件 | 實作 | 驗證 |
| --- | --- | --- |
| 角色區域在窄螢幕不超出主畫面，新增按鈕可見 | responsive header、受限 viewport 與卡片寬度 | build 與瀏覽器寬度檢查 |
| 零使用者角色有灰色預設 avatar | `.role-avatar-placeholder` | 元件 DOM 測試與瀏覽器檢查 |
| 卡片寬度超過容器時可向左右捲動 | scrollWidth / clientWidth 判定、控制按鈕與 resize/scroll 更新 | 元件測試與瀏覽器操作 |

角色決策：UI/UX 採用原有酒紅按鈕、暖灰邊框與 avatar 色調；Lead 以 Angular `afterNextRender` 在 DOM 佈局完成後讀取尺寸，避免以計時器推測渲染或平滑捲動狀態。

## 驗證

- PASS：`npm run build` 完成；僅保留專案既有的 bundle 與 component stylesheet budget warnings。
- PASS：本機 Demo 桌面實機檢視，角色與權限容器、三張角色卡片和新增角色按鈕均完整可見。
- PASS：已新增 DOM/邏輯回歸案例，覆蓋零使用者 avatar，以及溢位開始、中段、結尾的左右控制顯示。
- BLOCKED：`npm test -- --watch=false --browsers=ChromeHeadless --include=...` 無法啟動，既有 `node_modules` 缺少 `webpack`。未安裝或變更相依套件。
- NOT TESTED：實機窄視窗和動態零使用者卡片；目前 Mock 預設只有三個角色，且測試執行器無法啟動。CSS 已沿用專案既有的窄螢幕卡片規則與水平 viewport。

教訓（實作）：從父元件拆出互動清單時，需同時遷移 template 結構、DOM 尺寸量測與空狀態元素；只有保留卡片內容，會使既有 CSS selector 無法重新啟用 carousel 行為。
