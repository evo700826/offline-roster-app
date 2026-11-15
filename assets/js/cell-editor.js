/* 班表格子編輯器模組
 * 職責：把選取的班表格子資料載入編輯欄位，以及清除編輯狀態。
 * 不負責保存提案；保存由 proposal-manager.js 負責。
 */
function openTemplateEditor(coord){if(!templateEditable(coord))return;let x=EXCEL_TEMPLATE.cells[coord]||{},p=templateProposal(coord),old=p?p.changes[0].old_name:templateCurrentValue(coord);$('editDate').value='';$('editTask').value=(x.v||'班表位置')+'（'+coord+'）';$('editOld').value=old;$('editNew').value=p?p.changes[0].new_name:old;$('editNote').value=p?p.changes[0].note||'':'';$('editCellKey').value=coord;$('editorTitle').textContent='修改班表儲存格 '+coord;$('cellEditor').scrollIntoView({behavior:'smooth',block:'start'})}
function openCellEditor(key){let rec=scheduleRecords().find(x=>x.key===key);if(!rec)return;let p=pendingForCell(key);$('editDate').value=rec.date;$('editTask').value=rec.task;$('editOld').value=p?p.change.old_name:rec.name;$('editNew').value=p?p.change.new_name:rec.name;$('editNote').value=p?p.change.note:'';$('editCellKey').value=key;$('editorTitle').textContent='修改 '+rec.date+'｜'+rec.task;$('cellEditor').scrollIntoView({behavior:'smooth',block:'start'})}
function clearCellEditor(){['editDate','editTask','editOld','editNew','editNote','editCellKey'].forEach(id=>$(id).value='');$('editorTitle').textContent='班表格子修改'}
