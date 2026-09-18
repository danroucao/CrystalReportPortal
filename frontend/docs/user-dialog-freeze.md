# 使用者管理視窗無回應：2026-09-12

狀態：Done（本次定位到的角色表單重建問題）。

## 根因與修正

`MockRbacService.Roles` 每次讀取都複製角色物件。建立／編輯使用者視窗的角色 `ngFor` 沒有 `trackBy`，因此每輪變更偵測都銷毀、重建 checkbox 與 `NgModel`。Angular 17 的 `NgModel._updateValue()` 會排入 Promise 並呼叫 `markForCheck()`，使新元件再觸發更新，形成持續重建的迴圈。

使用者列表原有的列點擊事件會呼叫 `EditUser()`；真正失敗的是視窗開啟後的角色表單更新。四處角色清單改以 `Role.Key` 保留元件，包括角色卡片、篩選頁籤與兩個使用者視窗。保持角色 read model 的複製與權限判斷。

移除先前在二次驗證成功時新增的 `ChangeDetectorRef.detectChanges()`。自動變更偵測測試確認驗證後 Modal 與 `inert` 正常解除，不能把強制刷新當成重建迴圈的修復。

## 驗證證據

- 修正前，新增的建立／編輯視窗 DOM 身分測試皆失敗；每輪更新都換掉角色選項及卡片。
- 修正後，同一組測試通過。
- Chrome Headless：9 項相關測試通過（其餘 46 項未執行）。涵蓋二次驗證、真實帳號文字點擊、連續三輪開關視窗、角色 checkbox／文字／選項點擊，以及報表搜尋失焦的 DOM 穩定性。
- Edge 152：同一組 9 項相關測試通過。
- Angular 開發建置、Angular 測試模板編譯與 diff 檢查通過。
- 既有 `npm test` 管線缺少 `webpack`；本次使用已安裝的 Angular 編譯器、esbuild、Karma 與 Jasmine 在 `.angular/ui-regression-*` 暫存檔執行，未安裝依賴。迴歸案例保存在 `demo-portal.component.spec.ts`。

## 教訓

分類：實作、測試、診斷。含非同步表單指令的清單必須有穩定識別鍵。僅 spy 點擊處理方法，或只通過 TypeScript 編譯，無法證明視窗可互動；必須實際開啟視窗並等待 Angular 穩定。瀏覽器操作逾時、輸入未成功寫入都不能直接證明驗證成功或遮罩殘留。
