/* 資料交換模組：QR 分片、ZIP、SHA-256、Email 附件與匯入驗證。 */
// ZIP_STORED single-file package helpers: no external library or network required.




async function resetAllLocal(){if(!confirm('確定清除本機班表快照、歷史班表及所有待回傳修改？此動作無法復原。'))return;await RosterStorage.clear(STORE);snapshot=null;baseRevision='';proposals=[];historyItems=[];renderAll()}
