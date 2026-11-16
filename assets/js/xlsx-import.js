/* Excel XLSX 班表成品匯入：只更新班表矩陣，不覆蓋既有完整備份設定。 */
function xlsxColNumber(ref){let m=String(ref).match(/[A-Z]+/i);if(!m)return 0;let n=0;for(const c of m[0].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n}
function xlsxDateFromMatrix(matrix){const raw=String(matrix.get('1|23')||'')+' '+String(matrix.get('1|24')||'');let m=raw.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);if(!m)m=raw.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);return m?m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0'):''}
function xlsxTextNodes(doc,tag){return [...doc.getElementsByTagName(tag)]}
async function importScheduleXlsx(){
 try{
  const file=$('scheduleXlsxFile')?.files?.[0];if(!file)throw Error('請先選擇 Windows 輸出的 .xlsx 班表成品');
  if(!window.fflate?.unzipSync)throw Error('Excel 解壓模組尚未載入，請重新整理手機版');
  $('xlsxImportStatus').textContent='正在讀取 Excel 工作表…';
  const zip=window.fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
  const readXml=name=>{if(!zip[name])return null;return new DOMParser().parseFromString(new TextDecoder().decode(zip[name]),'application/xml')};
  const wb=readXml('xl/workbook.xml');if(!wb)throw Error('Excel 檔案缺少 workbook.xml');
  const rel=readXml('xl/_rels/workbook.xml.rels');if(!rel)throw Error('Excel 檔案缺少工作表關聯資料');
  const sheetNode=xlsxTextNodes(wb,'sheet')[0];if(!sheetNode)throw Error('Excel 檔案沒有工作表');
  const rid=sheetNode.getAttribute('r:id');
  const relation=xlsxTextNodes(rel,'Relationship').find(x=>x.getAttribute('Id')===rid);
  if(!relation)throw Error('找不到 Excel 第一張工作表');
  let target=relation.getAttribute('Target')||'worksheets/sheet1.xml';
  let sheetPath=target.startsWith('/')?target.slice(1):('xl/'+target).replace(/\\/g,'/');
  const norm=[];for(const p of sheetPath.split('/')){if(p==='..')norm.pop();else if(p!=='.')norm.push(p)}sheetPath=norm.join('/');
  const sheet=readXml(sheetPath);if(!sheet)throw Error('無法讀取 Excel 工作表：'+sheetPath);
  const sharedDoc=readXml('xl/sharedStrings.xml'),shared=sharedDoc?xlsxTextNodes(sharedDoc,'si').map(si=>xlsxTextNodes(si,'t').map(t=>t.textContent).join('')):[];
  const matrix=new Map();
  for(const c of xlsxTextNodes(sheet,'c')){
   const ref=c.getAttribute('r');if(!ref)continue;
   const m=ref.match(/([A-Z]+)(\d+)/i);if(!m)continue;
   const row=Number(m[2]),col=xlsxColNumber(ref);let value='';
   const type=c.getAttribute('t'),v=xlsxTextNodes(c,'v')[0];
   if(type==='s'&&v)value=shared[Number(v.textContent)]??'';
   else if(type==='inlineStr')value=xlsxTextNodes(c,'t').map(t=>t.textContent).join('');
   else if(v)value=v.textContent;
   matrix.set(row+'|'+col,String(value).trim());
  }
  if(!matrix.size)throw Error('Excel 工作表沒有可讀取的儲存格資料');
  const sheetRows=16,sheetCols=37,sheetMatrix=[];
  for(let row=1;row<=sheetRows;row++)for(let col=1;col<=sheetCols;col++)sheetMatrix.push({row,col,cell:excelCol(col)+row,value:String(matrix.get(row+'|'+col)??'')});
  const date=xlsxDateFromMatrix(matrix),rowPairs=[[2,3],[4,5],[6,7],[8,9],[10,11],[12,13]],scheduleCells=[],people=new Set();
  for(const [headRow,nameRow] of rowPairs)for(let col=2;col<=37;col++){
   const task=String(matrix.get(headRow+'|'+col)||'').trim(),name=String(matrix.get(nameRow+'|'+col)||'').trim();
   if(!name)continue;people.add(name);
   if(task)scheduleCells.push({date,task,name,employee_name:name,cell_key:(date||'xlsx')+'|'+task+'|'+excelCol(col)+nameRow,key:(date||'xlsx')+'|'+task+'|'+excelCol(col)+nameRow,meta:{cell_ref:excelCol(col)+nameRow,excel_cell:excelCol(col)+nameRow,source:'xlsx-product'}});
  }
  const bytes=new Uint8Array(await file.arrayBuffer()),digest=await crypto.subtle.digest('SHA-256',bytes),revision=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
  const prior=snapshot?.data||{},employees=Array.isArray(prior.employees)&&prior.employees.length?prior.employees:[...people].map(name=>({emp_id:'',name,status:'在職'}));
  const data={...prior,employees,sheet_matrix:{rows:sheetRows,cols:sheetCols,cells:sheetMatrix},schedule_cells:scheduleCells,schedule_entries:scheduleCells,backup_info:{...(prior.backup_info||{}),source:'Windows XLSX 班表成品',xlsx_filename:file.name,roster_date:date}};
  const snap={protocol:PROTOCOL,kind:'snapshot',exchange_id:crypto.randomUUID?crypto.randomUUID():('xlsx-'+Date.now()),base_revision:revision,data,created_at:new Date().toISOString(),source:'windows-xlsx-product'};
  validateSnapshotData(snap);acceptSnapshot(snap);
  $('xlsxImportStatus').textContent='匯入成功：'+file.name+'｜完整 16×37 儲存格｜班表日期 '+(date||'未能辨識')+'｜讀取到 '+scheduleCells.length+' 個班別人員位置。';
  alert('Excel 班表成品匯入完成，可在手機瀏覽及提出修改。原有完整備份的人員、技能及設定已保留。');
 }catch(e){$('xlsxImportStatus').textContent='匯入失敗：'+(e.message||String(e));alert(e.message||String(e))}
}
