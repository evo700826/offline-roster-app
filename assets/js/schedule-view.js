/* 班表顯示模組：只負責班表表格、Excel 格式預覽與縮放呈現。
 * 資料與提案由主流程提供；本模組不直接保存或修改班表資料。
 */
function styleCell(meta){let st=meta?.style||meta?.cell_style||{};let fill=st.fill||meta.fill||meta.background||'',color=st.font_color||meta.font_color||'',weight=st.bold?'bold':'normal';let css=[];if(/^#[0-9a-f]{6}$/i.test(fill))css.push('background:'+fill);if(/^#[0-9a-f]{6}$/i.test(color))css.push('color:'+color);css.push('font-weight:'+weight);return css.join(';')}
function buildGrid(records,target,editable){if(!records.length){target.innerHTML='<tbody><tr><td class="muted">沒有可顯示的班表資料</td></tr></tbody>';return}let dates=[...new Set(records.map(x=>x.date))].sort(),tasks=[...new Set(records.map(x=>x.task))];let html='<thead><tr><th class="row-head">班別／位置</th>'+dates.map(d=>`<th>${esc(d)}</th>`).join('')+'</tr></thead><tbody>';tasks.forEach(task=>{html+=`<tr><th class="row-head">${esc(task)}</th>`;dates.forEach(date=>{let rec=records.find(x=>x.task===task&&x.date===date);if(!rec){html+='<td class="empty">—</td>';return}let pending=editable?pendingForCell(rec.key):null,name=editable?currentName(rec):rec.name,cl=(editable?'editable ':'')+(pending?'pending ':'')+(!name?'empty':'');let click=editable?` onclick="openCellEditor('${esc(rec.key)}')"`:'';html+=`<td class="${cl}" style="${styleCell(rec.meta)}"${click}>${esc(name||'（空白）')}${pending?'<br><small>待確認</small>':''}</td>`});html+='</tr>'});target.innerHTML=html+'</tbody>'}
let sheetUserZoom=1,sheetPanX=0,sheetPanY=0,sheetPointers=new Map(),sheetGesture=null;
function fitExcelSheet(){
 const box=$('sheetScroll'),table=$('excelSheet');
 if(!box||!table||!table.rows.length)return;
 table.style.transform='none';table.style.left='50%';table.style.top='50%';
 table.style.position='absolute';table.style.transformOrigin='center center';table.style.width='max-content';table.style.margin='0';
 const w=table.offsetWidth||table.scrollWidth,h=table.offsetHeight||table.scrollHeight;
 if(!w||!h)return;
 // 手機保持直向，只有整張 Excel 班表順時針旋轉 90 度。
 // 旋轉後外框尺寸為 h × w，預設完整放入預覽框，放大後仍可拖曳查看。
 const availableW=Math.max(180,box.clientWidth-16),availableH=Math.max(180,box.clientHeight-16);
 const fit=Math.min(availableW/h,availableH/w);
 const scale=Math.max(.05,Math.min(3,fit*sheetUserZoom));
 table.style.transform=`translate(calc(-50% + ${sheetPanX}px),calc(-50% + ${sheetPanY}px)) rotate(90deg) scale(${scale})`;
 const label=$('sheetZoomLabel');if(label)label.textContent=Math.round(sheetUserZoom*100)+'% · 班表橫式90°';
}
function changeSheetZoom(delta){sheetUserZoom=Math.max(.25,Math.min(4,Math.round((sheetUserZoom+delta)*100)/100));fitExcelSheet()}
function resetSheetZoom(){sheetUserZoom=1;sheetPanX=0;sheetPanY=0;fitExcelSheet()}
function installSheetTouchControls(){
 const box=$('sheetScroll');if(!box||box.dataset.touchControls==='1')return;box.dataset.touchControls='1';
 box.style.touchAction='none';
 const point=e=>({x:e.clientX,y:e.clientY});
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 box.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  box.setPointerCapture?.(e.pointerId);sheetPointers.set(e.pointerId,point(e));
  if(sheetPointers.size===1){sheetGesture={kind:'pan',x:e.clientX,y:e.clientY,px:sheetPanX,py:sheetPanY}}
  else if(sheetPointers.size===2){const p=[...sheetPointers.values()];sheetGesture={kind:'pinch',distance:distance(p[0],p[1]),zoom:sheetUserZoom,center:{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},px:sheetPanX,py:sheetPanY}}
  e.preventDefault();
 });
 box.addEventListener('pointermove',e=>{
  if(!sheetPointers.has(e.pointerId))return;sheetPointers.set(e.pointerId,point(e));
  if(sheetPointers.size===1&&sheetGesture?.kind==='pan'){
   sheetPanX=sheetGesture.px+(e.clientX-sheetGesture.x);sheetPanY=sheetGesture.py+(e.clientY-sheetGesture.y);fitExcelSheet();
  }else if(sheetPointers.size>=2&&sheetGesture?.kind==='pinch'){
   const p=[...sheetPointers.values()],d=distance(p[0],p[1]);
   sheetUserZoom=Math.max(.25,Math.min(4,sheetGesture.zoom*d/Math.max(1,sheetGesture.distance)));
   const c={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};
   sheetPanX=sheetGesture.px+(c.x-sheetGesture.center.x);sheetPanY=sheetGesture.py+(c.y-sheetGesture.center.y);fitExcelSheet();
  }e.preventDefault();
 });
 const finish=e=>{sheetPointers.delete(e.pointerId);sheetGesture=null;if(sheetPointers.size===1){const [id,p]=[...sheetPointers.entries()][0];sheetGesture={kind:'pan',x:p.x,y:p.y,px:sheetPanX,py:sheetPanY}}};
 box.addEventListener('pointerup',finish);box.addEventListener('pointercancel',finish);box.addEventListener('lostpointercapture',finish);
}
window.addEventListener('resize',()=>requestAnimationFrame(fitExcelSheet));
document.addEventListener('DOMContentLoaded',installSheetTouchControls);
function colNum(a){let n=0;for(let c of a)n=n*26+c.charCodeAt(0)-64;return n}
function colLetters(n){let out='';while(n){let r=(n-1)%26;out=String.fromCharCode(65+r)+out;n=Math.floor((n-1)/26)}return out}
function excelStyle(c){let x=EXCEL_TEMPLATE.cells[c]||{},f=x.font||{},a=x.align||{},css=[];if(f.name)css.push('font-family:'+f.name+',serif');if(f.size)css.push('font-size:'+f.size+'pt');if(f.bold)css.push('font-weight:bold');if(f.italic)css.push('font-style:italic');if(f.color)css.push('color:'+f.color);if(x.fill)css.push('background:'+x.fill);if(f.color)css.push('color:'+f.color);if(f.color)css.push('color:'+f.color);if(a.h)css.push('text-align:'+({'center':'center','left':'left','right':'right'}[a.h]||'center'));if(a.v)css.push('vertical-align:'+({'center':'middle','top':'top','bottom':'bottom'}[a.v]||'middle'));if(a.wrap)css.push('white-space:pre-wrap');for(let [side,b] of Object.entries(x.border||{})){let [style,color]=b;let width=style==='double'?3:(['medium','thick'].includes(style)?2:1);css.push('border-'+side+':'+width+'px '+(style==='dashed'?'dashed':style==='dotted'?'dotted':'solid')+' '+(color||'#333'))}return css.join(';')}
function renderExcelSheet(){installSheetTouchControls();let t=EXCEL_TEMPLATE,covered=new Set(),mergeMap={};t.merges.forEach(m=>{let [a,b]=m.split(':');let ma=a.match(/[A-Z]+/)[0],mb=b.match(/[A-Z]+/)[0],ra=+a.match(/\d+/)[0],rb=+b.match(/\d+/)[0],cs=colNum(mb)-colNum(ma)+1,rs=rb-ra+1;mergeMap[a]={cs,rs};for(let r=ra;r<=rb;r++)for(let c=colNum(ma);c<=colNum(mb);c++){let q=colLetters(c)+r;if(q!==a)covered.add(q)}});
 let html='<colgroup>';for(let c=1;c<=t.cols;c++){let key=colLetters(c);html+=`<col style=\"width:${Math.max(8,Math.round(((t.colwidth[key]||9)*7+5)*0.32368))}px\">`}html+='</colgroup><tbody>';
 for(let r=1;r<=t.rows;r++){html+=`<tr style=\"height:${Math.round((t.rowheight[r]||22)*([2,4,6,8,10,12,14].includes(r)?1.3:([3,5,7,9,11,13].includes(r)?2.028:1))*10)/10}pt\">`;for(let c=1;c<=t.cols;c++){let coord=colLetters(c)+r;if(covered.has(coord))continue;let x=t.cells[coord]||{v:''},base=templateCurrentValue(coord),p=templateProposal(coord),v=p?(p.changes[0].new_name||''):base,m=mergeMap[coord]||{},editable=templateEditable(coord);let cls=(editable?'sheet-edit ':'')+(p?'sheet-pending':'');let click=editable?`onclick=\"openTemplateEditor('${coord}')\"`:'';html+=`<td class=\"${cls}\" style=\"${excelStyle(coord)}\" ${m.cs?`colspan=\"${m.cs}\"`:''} ${m.rs?`rowspan=\"${m.rs}\"`:''} ${click}>${esc(v)}</td>`}html+='</tr>'}html+='</tbody>';$('excelSheet').innerHTML=html;requestAnimationFrame(()=>fitExcelSheet());$('sheetStatus').textContent=`原始格式：${t.sheet}｜${t.rows}列×${t.cols}欄｜合併儲存格 ${t.merges.length} 處｜可修改格 ${t.editable.length} 格｜待確認修改 ${proposals.filter(p=>p.changes?.[0]?.cell_key?.match(/^[A-Z]+\d+$/)).length} 筆`}
function renderScheduleGrid(){let all=scheduleRecords(),rows=visibleScheduleRecords();if(snapshot?.data?.sheet_matrix?.cells?.length){$('scheduleState').textContent='完整班表已載入';$('scheduleNotice').textContent='目前上方已依 Windows 備份還原完整 16×37 班表位置與內容；含空白格。儲存格外觀沿用手機內建 Excel 格式範本。';$('scheduleGrid').innerHTML='<tbody><tr><td>完整班表請見上方「原始 Excel 班表預覽」。</td></tr></tbody>';return}if(!snapshot){$('scheduleState').textContent='尚未匯入';$('scheduleNotice').textContent='請先到「資料交換」匯入 Windows 班表。';$('scheduleGrid').innerHTML='<tbody><tr><td>尚未匯入班表資料</td></tr></tbody>';return}if(!all.length){$('scheduleState').textContent='快照未含班表';$('scheduleNotice').textContent='Windows 匯出資料缺少可辨識的 schedule_cells／schedule_entries。請先補齊匯出欄位，手機不會自行編造班表。';$('scheduleGrid').innerHTML='<tbody><tr><td>沒有班表格資料</td></tr></tbody>';return}if(!rows.length){$('scheduleState').textContent=`共 ${all.length} 格`;$('scheduleGrid').innerHTML='<tbody><tr><td>所選日期範圍沒有班表資料</td></tr></tbody>';return}buildGrid(rows,$('scheduleGrid'),true);$('scheduleState').textContent=`${new Set(rows.map(x=>x.date)).size} 日｜${new Set(rows.map(x=>x.task)).size} 個班別｜${proposals.length} 筆待確認`}
