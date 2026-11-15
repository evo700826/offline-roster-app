/* 人員與班表資料模型模組
 * 職責：統一讀取匯入快照、人員名單、班表記錄及待回傳提案的目前顯示值。
 * 不負責修改快照、保存資料或產生異動提案。
 */
function data(){return snapshot?.data||{}}
function employees(){return data().employees||[]}
function empNames(){return employees().map(x=>typeof x==='string'?x:x.name).filter(Boolean)}
function populateNames(){$('employeeOptions').innerHTML=empNames().map(n=>`<option value="${esc(n)}">`).join('')}
function normalizeRecords(d){let raw=d?.schedule_cells||d?.schedule_entries||d?.roster_entries||d?.daily_schedule||d?.schedule_days||d?.schedule||[],out=[];const add=(date,task,name,key,meta={})=>{if(!date||!task)return;out.push({date:String(date).slice(0,10),task:String(task),name:String(name??''),key:String(key??`${date}|${task}`),meta:meta||{}})};
 if(Array.isArray(raw))raw.forEach(x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x.cells)){x.cells.forEach(c=>add(x.date||x.day,c.task||c.slot||c.position,c.employee_name??c.name??c.person,c.cell_key??c.key??`${x.date||x.day}|${c.task||c.slot||c.position}`,c));return;}add(x.date||x.day||x.work_date,x.task||x.slot||x.position||x.row_label||x.duty,x.employee_name??x.assigned_name??x.name??x.person,x.cell_key||x.key||`${x.date||x.day||x.work_date}|${x.task||x.slot||x.position||x.row_label||x.duty}`,x)});
 else if(raw&&typeof raw==='object'){Object.entries(raw).forEach(([date,rows])=>{if(Array.isArray(rows))rows.forEach(x=>add(date,x.task||x.slot||x.position||x.row_label,x.employee_name??x.name??x.person,x.cell_key||`${date}|${x.task||x.slot||x.position||x.row_label}`,x));else if(rows&&typeof rows==='object')Object.entries(rows).forEach(([task,v])=>add(date,task,typeof v==='string'?v:(v?.employee_name??v?.name??v?.person),`${date}|${task}`,v))});if(!out.length&&Array.isArray(raw.rows))raw.rows.forEach(r=>Object.entries(r.assignments||r.days||{}).forEach(([date,name])=>add(date,r.task||r.label||r.position,typeof name==='string'?name:(name?.name??name?.employee_name),`${date}|${r.task||r.label||r.position}`,r)));}
 return out.sort((a,b)=>a.date.localeCompare(b.date)||a.task.localeCompare(b.task,'zh-Hant'));
}
function scheduleRecords(){return normalizeRecords(data())}
function visibleScheduleRecords(){let rows=scheduleRecords(),from=$('scheduleFrom').value,to=$('scheduleTo').value;if(from)rows=rows.filter(x=>x.date>=from);if(to)rows=rows.filter(x=>x.date<=to);return rows}
function pendingForCell(key){for(let i=proposals.length-1;i>=0;i--){let c=(proposals[i].changes||[]).find(x=>x?.cell_key===key);if(c)return {proposal:proposals[i],change:c,index:i}}return null}
function currentName(rec){let p=pendingForCell(rec.key);return p?p.change.new_name:rec.name}
