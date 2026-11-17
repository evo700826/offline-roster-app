/* 手機匯入：支援既有手機快照 ZIP，以及 Windows 原始完整備份 ZIP。 */
async function acceptSnapshot(snap){validateSnapshotData(snap);snapshot=snap;baseRevision=snap.base_revision;addHistory(snap);if(!(await persist()))throw Error('班表尚未成功保存到手機；請保持此頁開啟。')}
let sqlJsLoadPromise=null;
function loadSqlJsLibrary(){
  if(window.initSqlJs)return Promise.resolve(window.initSqlJs);
  if(sqlJsLoadPromise)return sqlJsLoadPromise;
  sqlJsLoadPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.js';
    script.onload=()=>window.initSqlJs?resolve(window.initSqlJs):reject(Error('SQLite 解讀模組載入後未初始化'));
    script.onerror=()=>reject(Error('無法載入 SQLite 解讀模組。請確認手機網路連線後重試。'));
    document.head.appendChild(script);
  }).catch(e=>{sqlJsLoadPromise=null;throw e});
  return sqlJsLoadPromise;
}
function sqlRows(db,table){
  try{const rs=db.exec('SELECT * FROM "'+table.replaceAll('"','""')+'"');if(!rs.length)return [];const {columns,values}=rs[0];return values.map(row=>Object.fromEntries(columns.map((c,i)=>[c,row[i]])))}
  catch(_){return []}
}
function excelCol(n){let s='';while(n>0){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s}
function parseBackupDate(matrix){
  const raw=String(matrix.get('1|23')||'')+' '+String(matrix.get('1|24')||'');
  let m=raw.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if(!m)m=raw.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  return m?m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0'):'';
}
async function convertWindowsFullBackup(zipFiles,manifest){
  const sqliteBytes=zipFiles['roster_backup.sqlite'];
  if(!sqliteBytes)throw Error('完整備份缺少 roster_backup.sqlite');
  const magic=new TextDecoder().decode(sqliteBytes.slice(0,16));
  if(magic!=='SQLite format 3\u0000')throw Error('roster_backup.sqlite 不是有效的 SQLite 資料庫');
  $('fileImportStatus').textContent='正在載入 SQLite 解讀模組…';
  const initSqlJs=await loadSqlJsLibrary();
  const SQL=await initSqlJs({locateFile:file=>'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/'+file});
  $('fileImportStatus').textContent='正在讀取完整備份資料…';
  const db=new SQL.Database(sqliteBytes);
  try{
    const employees=sqlRows(db,'employees').map(x=>({emp_id:String(x.emp_id||''),name:String(x.name||''),status:String(x.status||'在職')})).filter(x=>x.name);
    const skillRows=sqlRows(db,'skills').sort((a,b)=>String(a.task).localeCompare(String(b.task),'zh-Hant')||Number(a.rank)-Number(b.rank));
    const skillMap={};skillRows.forEach(x=>{const task=String(x.task||'').trim(),name=String(x.name||'').trim();if(task&&name){if(!skillMap[task])skillMap[task]=[];skillMap[task].push(name)}});
    const leaveEntries=sqlRows(db,'leave_entries').map(x=>{const month=String(x.month||'');const date=month?month+'-'+String(x.day||'').padStart(2,'0'):'';return {...x,date,employee_name:String(x.name||''),type:String(x.reason||'預定休假')}}).filter(x=>x.name);
    const fixedSlots=sqlRows(db,'fixed_slots');
    const fixedLegacy=sqlRows(db,'fixed');
    const settings=Object.fromEntries(sqlRows(db,'settings').map(x=>[String(x.k),String(x.v??'')]));
    const yesterday=sqlRows(db,'yesterday');
    const matrix=new Map(yesterday.map(x=>[String(x.row_no)+'|'+String(x.col_no),String(x.value??'').trim()]));
    const rosterDate=parseBackupDate(matrix),employeeSet=new Set(employees.map(x=>x.name)),scheduleCells=[];
    const rowPairs=[[2,3],[4,5],[6,7],[8,9],[10,11],[12,13]];
    if(rosterDate){
      for(const [headRow,nameRow] of rowPairs){
        for(let col=2;col<=37;col++){
          const task=String(matrix.get(headRow+'|'+col)||'').replace(/\s+/g,' ').trim();
          const person=String(matrix.get(nameRow+'|'+col)||'').trim();
          if(!task||!person||!employeeSet.has(person))continue;
          const cellRef=excelCol(col)+nameRow;
          scheduleCells.push({date:rosterDate,task,name:person,employee_name:person,cell_key:rosterDate+'|'+task+'|'+cellRef,key:rosterDate+'|'+task+'|'+cellRef,meta:{cell_ref:cellRef,excel_cell:cellRef,source:'yesterday'}});
        }
      }
    }
    const rotationDetails=sqlRows(db,'rotation_details').map(x=>({...x,metrics:(()=>{try{return JSON.parse(x.metrics||'[]')}catch(_){return []}})()}));
    let rotationDetailsJson=null;
    if(zipFiles['rotation_details.json']){try{rotationDetailsJson=JSON.parse(new TextDecoder().decode(zipFiles['rotation_details.json']))}catch(_){rotationDetailsJson=null}}
    // 完整保存 16×37 儲存格矩陣，包含空白格；不再只擷取人員名單列。
    const sheetRows=16,sheetCols=37,sheetMatrix=[];
    for(let row=1;row<=sheetRows;row++)for(let col=1;col<=sheetCols;col++){
      sheetMatrix.push({row,col,cell:excelCol(col)+row,value:String(matrix.get(row+'|'+col)??'')});
    }
    const scheduleHistory=sqlRows(db,'schedule_history');
    const backupSettings={
      employees,skills:Object.entries(skillMap).map(([task,names])=>({task,employees:names})),skill_rows:Object.entries(skillMap).map(([task,names])=>({task,employees:names})),skill_rank_rows:skillRows,
      leave_entries:leaveEntries,leaves:sqlRows(db,'leaves'),fixed_slots:fixedSlots,fixed:fixedLegacy,
      settings,rotation_details:rotationDetails,rotation_details_json:rotationDetailsJson,yesterday,
      sheet_matrix:{rows:sheetRows,cols:sheetCols,cells:sheetMatrix},schedule_cells:scheduleCells,
      backup_info:{format:manifest.format,version:manifest.version,app_version:manifest.app_version,exported_at:manifest.exported_at,roster_date:rosterDate,schedule_history_count:scheduleHistory.length,source:'Windows 完整備份 ZIP'}
    };
    const digest=await crypto.subtle.digest('SHA-256',sqliteBytes);
    const revision=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
    const snap={protocol:PROTOCOL,kind:'snapshot',exchange_id:crypto.randomUUID?crypto.randomUUID():('backup-'+Date.now()),base_revision:revision,data:backupSettings,created_at:manifest.exported_at||new Date().toISOString(),source:'windows-full-backup'};
    validateSnapshotData(snap);
    return {snap,counts:{employees:employees.length,skills:skillRows.length,leaves:leaveEntries.length,fixed:fixedSlots.length,rotation:rotationDetails.length,schedule:scheduleCells.length,sheetCells:sheetMatrix.length,scheduleHistory:scheduleHistory.length,rosterDate}};
  }finally{db.close()}
}
async function importSnapshotFile(){
  try{
    const f=$('snapshotFile').files[0];if(!f)throw Error('請先選擇 Email 附件 ZIP');
    if(!window.fflate?.unzipSync)throw Error('ZIP 解壓模組尚未載入。請確認網路連線並重新整理手機版。');
    $('fileImportStatus').textContent='正在解壓 ZIP…';
    let files;try{files=window.fflate.unzipSync(new Uint8Array(await f.arrayBuffer()))}catch(e){throw Error('ZIP 解壓失敗：'+(e.message||String(e)))}
    const entries={};for(const [name,data] of Object.entries(files))entries[name]=data;
    if(entries['roster_backup.sqlite']){
      if(!entries['manifest.json'])throw Error('Windows 完整備份缺少 manifest.json');
      let manifest;try{manifest=JSON.parse(new TextDecoder().decode(entries['manifest.json']))}catch(_){throw Error('Windows 完整備份 manifest.json 格式錯誤')}
      if(manifest.format!=='roster-local-backup'||Number(manifest.version)!==1)throw Error('這不是支援的 Windows 完整備份格式');
      const converted=await convertWindowsFullBackup(entries,manifest);
      await acceptSnapshot(converted.snap);
      const q=converted.counts;
      let note='已讀取 Windows 完整備份：人員 '+q.employees+' 人、技能 '+q.skills+' 筆、預定休假 '+q.leaves+' 筆、固定區段 '+q.fixed+' 筆、輪休明細 '+q.rotation+' 人。';
      if(q.scheduleHistory===0)note+='\n注意：此備份沒有正式班表歷史資料；手機已還原完整 16×37 班表矩陣，共 '+q.sheetCells+' 個儲存格（含空白位置）；日期 '+(q.rosterDate||'未取得')+'。';
      else note+='\n正式班表歷史 '+q.scheduleHistory+' 筆；手機目前顯示完整 16×37 班表矩陣。';
      $('fileImportStatus').textContent=note;
      alert('Windows 完整備份已匯入手機。\n'+note);
      return;
    }
    if(!entries['roster_snapshot.json'])throw Error('ZIP 內找不到 roster_snapshot.json，也找不到 Windows 完整備份資料庫 roster_backup.sqlite');
    const data=entries['roster_snapshot.json'],snap=JSON.parse(new TextDecoder().decode(data));
    const manifestBytes=entries['manifest.json'];if(!manifestBytes)throw Error('資料包缺少 manifest.json');
    const manifest=JSON.parse(new TextDecoder().decode(manifestBytes));
    const digest=await crypto.subtle.digest('SHA-256',data),hex=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(manifest.package!=='roster-phone-transfer'||![1,2].includes(manifest.package_version)||manifest.kind!=='snapshot'||(manifest.package_version===2&&manifest.payload_file!=='roster_snapshot.json')||manifest.exchange_id!==snap.exchange_id||manifest.base_revision!==snap.base_revision||manifest.sha256!==hex)throw Error('資料包清單或 SHA-256 驗證失敗');
    await acceptSnapshot(snap);$('fileImportStatus').textContent='匯入成功：'+normalizeRecords(snap.data).length+' 格，版本 '+snap.base_revision.slice(0,16);alert('Windows 班表快照匯入成功。');
  }catch(e){$('fileImportStatus').textContent='匯入失敗：'+e.message;alert(e.message)}
}
