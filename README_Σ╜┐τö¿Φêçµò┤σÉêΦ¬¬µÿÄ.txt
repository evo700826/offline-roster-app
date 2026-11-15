手機排班 APP v0.5.185｜電腦版「臨時異動人員」移植開發版

本版手機功能：
1. 班表預覽（依格式1.xlsx 呈現）。
2. 臨時異動人員（本版核心）。
3. 歷史班表唯讀瀏覽。
4. 離線 QR 資料交換。

臨時異動操作：
1. 先由 Windows 匯出並以 QR 匯入班表快照。
2. 進入「臨時異動人員」，選擇目前班表或歷史班表，再選擇日期。
3. 最多建立三組新增／移除人員配對（對應電腦版 AL3:AL5、AO3:AO5）。
4. 按「計算最少變動方案」。系統先嘗試新增者直接接替移除者原班；不符技能時，以 BFS 搜尋最少職務槽位連鎖路徑；同長度路徑按技能順位優先。
5. 所有組別均有可行方案且不產生重複排班，才可確認並建立一筆完整群組提案。
6. 回到「資料交換」產生 QR Code，Windows 接收審核工具可驗證並匯出核准 JSON。

Windows 快照資料契約（目前手機端需求）：
- base_revision：不可缺少，用來防止基礎版本混淆。
- schedule_cells 或 schedule_entries：每筆至少包含 date、task、employee_name、cell_key，以及 cell_ref 或 excel_cell（Excel 儲存格座標）。
- 技能順位：建議 skills 為陣列，每列 {task/role, employees:[按順位排列的人員姓名]}；亦支援 skill_rows、skill_map 等常見格式。陣列順序即順位，不可打亂。
- employees：人員名單。
- 班表第13列 B:U 輪休槽位需包含在 schedule_cells，或有對應 cell_ref 的休假／輪休資料，供移除者轉入輪休時定位。
- 日期、人員與職務文字需與技能表完全一致；手機不猜技能、不自動修正姓名。

重要限制：
- 本版已完成手機端演算與封包資料結構，但 Windows 正式排班程式尚未接入 schema_version 5 的 temporary_staff_change 群組、rest_changes 逐格寫回及基礎版本／原值二次核對。
- Windows_手機異動接收審核.html 目前負責封包完整性驗證、顯示異動、逐筆核准及匯出 JSON；它不是 Windows 正式 Excel 寫回器。
- 實際 Windows 匯出快照格式尚未提供本次實測，因此尚未做真實資料端對端驗收。
- 本版暫不進行 iPhone 實機測試；請先完成 Windows 匯出／匯入整合。


【v0.5.186 QR + Email 雙管道】
電腦→手機：資料交換頁可掃描 Windows QR，也可選取從 Email 下載的 Windows ZIP 資料包，按「匯入資料包」。匯入時會檢查 ZIP CRC、manifest SHA-256、交換編號及版本；失敗不替換目前手機資料。
手機→電腦：完成臨時異動後，可按「產生回傳 QR Code」，或「匯出 Email 回傳資料包（ZIP）」。將下載 ZIP 當附件寄回 Windows，Windows 管理中心選擇「匯入手機回傳資料包（Email）」即可逐組審核。
QR 與 Email 共用相同 snapshot/return schema 及 Windows 審核寫回器。Email 附件由使用者自行寄送，程式不會自動登入郵件帳號。資料含人員個資，請只寄送至授權信箱。


v0.5.193 模組化改版：
- assets/css/app.css：介面樣式獨立。
- assets/js/qr.js：離線 QR 編碼器獨立（移除重複載入的一份相同程式碼）。
- assets/js/excel-template.js：原始 Excel 範本資料獨立。
- assets/js/app.js：APP 主流程。
- sw.js：快取版本升級並納入上述模組檔案。
各模組以固定載入順序及 window.EXCEL_TEMPLATE 作為範本接口；本版未改動既有資料交換格式與排班異動演算法。

v0.5.194 模組拆分：
- assets/js/temp-change.js：臨時異動人員、技能順位、最少連鎖調整與提案確認。
- assets/js/data-exchange.js：QR 分片、ZIP 封包、SHA-256 驗證、Email 附件與資料匯入。
- assets/js/app.js：共用狀態、班表畫面、Excel 格式渲染、歷史顯示及啟動流程。
- 三者使用傳統 script 載入順序，保留既有全域函式名稱與 HTML onclick 相容性；本次僅搬移函式，不改寫異動演算法或封包欄位。

v0.5.195 修正與檢查：
- 補齊班表格子編輯器 HTML 控制項；先前主程式有編輯函式但頁面缺少對應欄位，會導致點選編輯時找不到元素。
- 匯入班表的日期／班別表格啟用格子點選，修改仍只保存為待回傳提案，不直接改 Windows 正式班表。
- 補齊 PWA 所需 icons/icon-192.png、icon-512.png、apple-touch-icon.png，避免 Service Worker 預快取與 manifest 指向不存在檔案。
- 更新頁面顯示版本及 Service Worker 快取版本至 v0.5.195。
- 已通過所有 JavaScript 檔案 node --check、程式引用的 HTML 固定 ID 完整性檢查、Service Worker 預快取檔案存在檢查及 ZIP 完整性檢查。
- Chromium headless 在此執行環境啟動逾時，未能完成瀏覽器執行驗證；iPhone Safari 尚未實機驗證。


v0.5.197：新增本機資料儲存模組 storage.js，集中管理快照、待回傳提案及歷史資料的保存／載入／清除；支援舊版 roster_phone_177 資料遷移，保存後回讀驗證。Email 收件地址仍獨立保存，不受清除班表資料影響。


v0.5.198：新增 schedule-view.js，將班表資料表格呈現、Excel 原始格式預覽、合併儲存格繪製、旋轉縮放與日期班表檢視函式從 app.js 抽離；保留既有全域函式介面與 classic script 載入順序，未改動異動演算及資料交換規則。


v0.5.199：新增 roster-data.js，集中管理匯入快照資料、人員名單、班表記錄正規化、日期範圍資料、待回傳格子的目前顯示值；從 app.js 抽離資料讀取與正規化函式，維持原有全域函式介面及輸出結構。


v0.5.200：新增 proposal-manager.js，集中處理班表格子提案建立、同格提案更新、待回傳提案清單呈現及撤回；臨時異動演算仍維持在 temp-change.js，兩者透過 proposals 共用狀態及 persist() 介面銜接。


v0.5.201：新增 cell-editor.js，獨立處理原始 Excel 班表格子與匯入班表格子的選取、編輯欄位載入及取消清空；提案保存仍由 proposal-manager.js 負責，避免畫面編輯器直接管理提案資料。


v0.5.202：新增 app-bootstrap.js，將 APP 啟動、分頁事件綁定、QR 相機啟動事件與 Service Worker 註冊從核心 app.js 抽離；app.js 保留共用狀態及核心協調函式，啟動流程統一由 bootstrap 管理。


v0.5.203：新增 zip-package.js，將 ZIP_STORED 封裝、解封、CRC32 完整性檢查及下載工具從資料交換模組抽離。資料交換模組保留快照匯入、QR 分片、回傳封包與 Email 分享流程。


v0.5.204：新增 qr-receiver.js，將 QR 分片接收、批次一致性檢查、SHA-256 驗證、解壓、快照匯入及掃描停止／清除流程抽離。QR 產生與回傳封包仍留在資料交換流程。


v0.5.205：新增 qr-sender.js，將 QR 回傳封包建立、deflate 壓縮、SHA-256 分片、QR 顯示及文字備援複製抽離。並補齊 QR 回傳 payload 的 rest_changes，與 Email ZIP 回傳內容一致。


v0.5.206：新增 email-transfer.js，將 Email 收件地址保存、iOS ZIP 分享及回傳 ZIP 封裝／SHA-256 自我驗證流程抽離。資料交換核心不再直接承擔 Email UI 與分享流程。


v0.5.207：新增 snapshot-import.js，將 Windows 班表快照 ZIP 匯入、manifest 欄位及 SHA-256 驗證、快照必要欄位檢查與匯入後歷史保存抽離。

v0.5.208：新增 snapshot-validation.js，統一 QR 與 Email ZIP 的快照必要欄位、協定、批次編號及 base_revision 驗證；兩種匯入方式共用同一入口檢查。


v0.5.209：新增共用回傳異動驗證，QR 與 Email ZIP 輸出前檢查基準版本、提案內容、班表異動及輪休異動欄位。


v0.5.210：共用回傳驗證新增跨提案班表儲存格重複、同日人員重複及輪休位置重複檢查，避免衝突提案輸出。


v0.5.211：QR 與 Email ZIP 回傳前，增加提案修改前值與原始快照逐格比對；不一致或找不到位置時拒絕產生回傳資料。此為手機原始快照一致性檢查，Windows 最新班表衝突仍須由 Windows 匯入審核端再次比對。


v0.5.213：加強輪休異動驗證，限制位置為第 13 列 C 至 V 欄，僅接受新增／移除輪休動作，並拒絕無效或重複的輪休變更。


v0.5.215：Windows 寫入端亦限制輪休座標為 B13:U13，與手機端驗證一致。
