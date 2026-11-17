/* 手機 APP 主流程：班表顯示、異動、歷史與資料交換。 */
const EXCEL_TEMPLATE = window.EXCEL_TEMPLATE;
const $=id=>document.getElementById(id), PROTOCOL='roster-offline-qr-v1', STORE='roster_phone_185';
let snapshot=null,baseRevision='',proposals=[],parts={},chunkMeta=null,stream=null,historyItems=[];
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function persist(){try{await RosterStorage.save(STORE,{snapshot,baseRevision,proposals,historyItems});try{renderAll()}catch(renderError){console.error('資料已保存，但畫面更新失敗',renderError);alert('資料已成功保存到手機，但畫面更新發生錯誤。請勿清除資料，可重新整理畫面。')}return true}catch(e){alert('手機資料保存失敗：'+(e.message||'儲存空間不足')+'。目前畫面資料仍保留，請勿關閉網頁。');return false}}
async function restore(){let x=await RosterStorage.load(STORE);if(x){snapshot=x.snapshot;baseRevision=x.baseRevision;proposals=x.proposals;historyItems=x.historyItems;if(snapshot)addHistory(snapshot);}}
function renderXlsxPagePicker(){const box=$('xlsxPagePicker'),select=$('xlsxPageSelect'),pages=snapshot?.data?.schedule_pages||[];if(!box||!select)return;box.classList.toggle('hidden',pages.length<2);if(pages.length){select.innerHTML=pages.map(p=>`<option value="${esc(p.date||p.title)}" ${p.date===(snapshot.data.active_schedule_date||pages[0].date)?'selected':''}>${esc(p.date||p.title)}</option>`).join('');}}
function setScheduleRange(days){let today=new Date(),end=new Date(today);end.setDate(end.getDate()+days-1);$('scheduleFrom').value=today.toISOString().slice(0,10);$('scheduleTo').value=end.toISOString().slice(0,10);renderScheduleGrid()}
function templateCurrentValue(coord,sourceData=snapshot?.data){
 const full=sourceData?.sheet_matrix;
 if(full?.cells?.length){const hit=full.cells.find(x=>String(x.cell||'').toUpperCase()===coord);if(hit)return String(hit.value??'')}
 const recs=sourceData===snapshot?.data?scheduleRecords():normalizeRecords(sourceData||{});
 let rec=recs.find(r=>String(r.meta?.cell_ref||r.meta?.cell_key||r.meta?.excel_cell||'').toUpperCase()===coord);
 return rec?currentName(rec):(EXCEL_TEMPLATE.cells[coord]?.v||'')
}
function templateEditable(coord){if(!Array.isArray(EXCEL_TEMPLATE.editable)||!EXCEL_TEMPLATE.editable.includes(coord))return false;const cell=EXCEL_TEMPLATE.cells[coord]||{};if(String(cell.v??'').trim()!=='')return false;for(const m of EXCEL_TEMPLATE.merges||[]){const [a,b]=m.split(':');const ma=a.match(/[A-Z]+/)[0],mb=b.match(/[A-Z]+/)[0],ra=+a.match(/\d+/)[0],rb=+b.match(/\d+/)[0],r=+coord.match(/\d+/)[0],c=colNum(coord.match(/[A-Z]+/)[0]);if(r>=ra&&r<=rb&&c>=colNum(ma)&&c<=colNum(mb))return false;}return true}

function renderAll(){renderXlsxPagePicker();renderExcelSheet();let recs=scheduleRecords();$('status').innerHTML=snapshot?`<span class="badge">已載入班表</span><br>完整班表 ${snapshot.data?.sheet_matrix?.cells?.length===592?'16列×37欄（592格）':'尚未含完整儲存格矩陣'}｜人員 ${employees().length}｜待確認修改 ${proposals.length}｜本機歷史版本 ${historyItems.length}`:'尚未載入 Windows 班表';$('changeSummary').textContent=`待確認班表修改 ${proposals.length} 筆`;populateNames();renderProposalList();renderScheduleGrid();if($('tempchange').classList.contains('active'))initTempChange();if($('history').classList.contains('active'))renderHistory()}
