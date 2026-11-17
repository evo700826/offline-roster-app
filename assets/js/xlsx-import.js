/* Excel XLSX 班表成品匯入：只更新班表矩陣，不覆蓋既有完整備份設定。 */
function xlsxColNumber(ref){let m=String(ref).match(/[A-Z]+/i);if(!m)return 0;let n=0;for(const c of m[0].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n}
function xlsxDateFromMatrix(matrix){const raw=String(matrix.get('1|23')||'')+' '+String(matrix.get('1|24')||'');let m=raw.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);if(!m)m=raw.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);return m?m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0'):''}
function xlsxTextNodes(doc,tag){return [...doc.getElementsByTagName(tag)]}
function xlsxMatrixFromSheet(zip, sheetPath){
 const readXml=name=>{if(!zip[name])return null;const d=new DOMParser().parseFromString(new TextDecoder().decode(zip[name]),'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('Excel XML 格式錯誤：'+name);return d};
 const sheet=readXml(sheetPath);if(!sheet)throw Error('無法讀取工作表：'+sheetPath);
 const sharedDoc=readXml('xl/sharedStrings.xml'),shared=sharedDoc?xlsxTextNodes(sharedDoc,'si').map(si=>xlsxTextNodes(si,'t').map(t=>t.textContent).join('')):[];
 const matrix=new Map();
 for(const c of xlsxTextNodes(sheet,'c')){const ref=c.getAttribute('r');if(!ref)continue;const m=ref.match(/([A-Z]+)(\d+)/i);if(!m)continue;const row=Number(m[2]),col=xlsxColNumber(ref);let value='';const type=c.getAttribute('t'),v=xlsxTextNodes(c,'v')[0];if(type==='s'&&v)value=shared[Number(v.textContent)]??'';else if(type==='inlineStr')value=xlsxTextNodes(c,'t').map(t=>t.textContent).join('');else if(v)value=v.textContent;matrix.set(row+'|'+col,String(value).trim())}
 if(!matrix.size)throw Error('Excel 工作表沒有可讀取的儲存格資料');return matrix;
}
function xlsxBuildPage(matrix,title){
 const sheetMatrix=[];for(let row=1;row<=16;row++)for(let col=1;col<=37;col++)sheetMatrix.push({row,col,cell:excelCol(col)+row,value:String(matrix.get(row+'|'+col)??'')});
 const date=xlsxDateFromMatrix(matrix),rows=[[2,3],[4,5],[6,7],[8,9],[10,11],[12,13]],cells=[],people=new Set();
 for(const [hr,nr] of rows)for(let col=2;col<=37;col++){const task=String(matrix.get(hr+'|'+col)||'').trim(),name=String(matrix.get(nr+'|'+col)||'').trim();if(!name)continue;people.add(name);if(task){const ref=excelCol(col)+nr,key=(date||title)+'|'+task+'|'+ref;cells.push({date,task,name,employee_name:name,cell_key:key,key,meta:{cell_ref:ref,excel_cell:ref,source:'xlsx-product',sheet:title}})}}
 return {title,date,sheet_matrix:{rows:16,cols:37,cells:sheetMatrix},schedule_cells:cells,people:[...people]};
}
function switchXlsxPage(value){
 if(!snapshot?.data?.schedule_pages?.length)return;
 const page=snapshot.data.schedule_pages.find(p=>p.date===value||p.title===value);if(!page)return;
 snapshot.data.active_schedule_date=page.date;snapshot.data.sheet_matrix=page.sheet_matrix;
 const dateEl=$('editDate');if(dateEl)dateEl.value='';
 persist();
}
async function persistXlsxSnapshot(snap){snapshot=snap;baseRevision=snap.base_revision;addHistory(snap);return await persist()}
async function importScheduleXlsx(){
 try{
  const file=$('scheduleXlsxFile')?.files?.[0];if(!file)throw Error('請先選擇 Windows 輸出的 .xlsx 班表成品');
  if(!window.fflate?.unzipSync)throw Error('Excel 解壓模組尚未載入，請重新整理手機版');
  $('xlsxImportStatus').textContent='正在讀取 Excel 工作表…';
  const zip=window.fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
  const readXml=name=>{if(!zip[name])return null;return new DOMParser().parseFromString(new TextDecoder().decode(zip[name]),'application/xml')};
  const wb=readXml('xl/workbook.xml');if(!wb)throw Error('Excel 檔案缺少 workbook.xml');
  const rel=readXml('xl/_rels/workbook.xml.rels');if(!rel)throw Error('Excel 檔案缺少工作表關聯資料');
  const sheetNodes=xlsxTextNodes(wb,'sheet');if(!sheetNodes.length)throw Error('Excel 檔案沒有工作表');
  const relationships=xlsxTextNodes(rel,'Relationship');
  const pages=[];
  for(const node of sheetNodes){
   const rid=node.getAttribute('r:id'),relationship=relationships.find(x=>x.getAttribute('Id')===rid);
   if(!relationship)continue;
   let target=relationship.getAttribute('Target')||'worksheets/sheet1.xml';
   let path=target.startsWith('/')?target.slice(1):('xl/'+target).replace(/\\\\/g,'/');
   const norm=[];for(const p of path.split('/')){if(p==='..')norm.pop();else if(p!=='.')norm.push(p)}path=norm.join('/');
   const matrix=xlsxMatrixFromSheet(zip,path);
   pages.push(xlsxBuildPage(matrix,node.getAttribute('name')||('工作表'+(pages.length+1))));
  }
  if(!pages.length)throw Error('沒有可讀取的 Excel 工作表');
  const prior=snapshot?.data||{};
  const existingPages=Array.isArray(prior.schedule_pages)?prior.schedule_pages:[];
  const pageKey=p=>String(p.date||p.title||'').trim();
  // 相同日期以本次 Windows Excel 為準完整覆蓋；不同日期保留累加。
  const existingByKey=new Map(existingPages.map(p=>[pageKey(p),p]));
  const addedPages=pages.filter(p=>!existingByKey.has(pageKey(p)));
  const replacedPages=pages.filter(p=>existingByKey.has(pageKey(p)));
  const mergedByKey=new Map(existingPages.map(p=>[pageKey(p),p]));
  for(const page of pages)mergedByKey.set(pageKey(page),page);
  const mergedPages=[...mergedByKey.values()].sort((a,b)=>pageKey(a).localeCompare(pageKey(b)));
  const allCells=mergedPages.flatMap(p=>p.schedule_cells||[]),allPeople=new Set(mergedPages.flatMap(p=>p.people||[]));
  const date=pages[0].date;
  const bytes=new Uint8Array(await file.arrayBuffer()),digest=await crypto.subtle.digest('SHA-256',bytes),revision=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
  const priorEmployees=Array.isArray(prior.employees)?prior.employees:[];
  const employeeNames=new Set(priorEmployees.map(x=>typeof x==='string'?x:x?.name).filter(Boolean));
  const employees=[...priorEmployees,...[...allPeople].filter(name=>!employeeNames.has(name)).map(name=>({emp_id:'',name,status:'在職'}))];
  // 匯入後直接顯示本次檔案第一個工作表。
  const activeKey=pageKey(pages[0]);
  const activePage=mergedPages.find(p=>pageKey(p)===activeKey)||pages[0];
  const data={...prior,employees,sheet_matrix:activePage?.sheet_matrix||pages[0].sheet_matrix,schedule_pages:mergedPages,active_schedule_date:activePage?.date||'',schedule_cells:allCells,schedule_entries:allCells,backup_info:{...(prior.backup_info||{}),source:'Windows XLSX 班表成品',xlsx_filename:file.name,roster_date:date,schedule_dates:mergedPages.map(p=>p.date||p.title),xlsx_import_files:[...(prior.backup_info?.xlsx_import_files||[]),file.name]}};
  const snap={protocol:PROTOCOL,kind:'snapshot',exchange_id:crypto.randomUUID?crypto.randomUUID():('xlsx-'+Date.now()),base_revision:revision,data,created_at:new Date().toISOString(),source:'windows-xlsx-product'};
  validateSnapshotData(snap);if(!(await persistXlsxSnapshot(snap)))throw Error('手機儲存失敗；請保持頁面開啟，不要重新匯入。');
  $('xlsxImportStatus').textContent='匯入完成：'+file.name+'｜本次新增 '+addedPages.length+' 天，覆蓋更新 '+replacedPages.length+' 天｜目前累計 '+mergedPages.length+' 天。';
  alert('Excel 匯入完成！本次新增 '+addedPages.length+' 天，相同日期已由新檔完整取代 '+replacedPages.length+' 天。\n目前累計 '+mergedPages.length+' 天，可切換日期查看及提出修改。');
 }catch(e){$('xlsxImportStatus').textContent='匯入失敗：'+(e.message||String(e));alert(e.message||String(e))}
}
