/* 人員與技能唯讀面板：每一個技能項目各有獨立下拉選單。 */
function skillTask(x){return String(x.task||x.skill||x.skill_name||'').trim()}
function skillName(x){return String(x.name||x.employee_name||x.person_name||'').trim()}
function skillRank(x){const n=Number(x.rank??x.priority??x.order??x.sequence);return Number.isFinite(n)?n:999999}
function skillGroup(task){const t=String(task||'');if(/^市/.test(t))return 0;if(/^村/.test(t))return 1;if(/^包/.test(t))return 2;if(/^快早/.test(t))return 3;if(/^快晚收/.test(t)||/^快晚/.test(t)||/^收/.test(t))return 4;if(/^接/.test(t))return 5;if(/^內勤/.test(t))return 6;return 7}
function orderedSkillTasks(){return [...new Set((data().skills||[]).map(skillTask).filter(Boolean))].sort((a,b)=>skillGroup(a)-skillGroup(b)||a.localeCompare(b,'zh-Hant',{numeric:true}))}
function skillEmployeeLabel(x,index){const name=skillName(x),emp=employees().find(e=>(typeof e==='string'?e:e.name)===name);const id=(typeof emp==='object'&&emp?emp.emp_id:'')||x.emp_id||x.employee_id||'';const rank=x.rank??x.priority??x.order??x.sequence??(index+1);return `順位 ${rank}｜${id?String(id)+'　':''}${name}`}
function renderSkillOptions(){renderSkillPeople()}
function renderSkillPeople(){
 const box=$('skillTaskList');if(!box)return;
 const skills=data().skills||[],tasks=orderedSkillTasks();
 if(!skills.length){box.textContent='尚未匯入 Windows 技能資料';return}
 box.innerHTML=tasks.map((task,ti)=>{
  const rows=skills.filter(x=>skillTask(x)===task&&skillName(x)).sort((a,b)=>skillRank(a)-skillRank(b)||skillName(a).localeCompare(skillName(b),'zh-Hant'));
  const opts=rows.map((x,i)=>`<option value="${esc(skillName(x))}">${esc(skillEmployeeLabel(x,i))}</option>`).join('');
  return `<div class="skill-task-row"><label for="skillTask_${ti}">${esc(task)}</label><select id="skillTask_${ti}" aria-label="${esc(task)}人員名單"><option value="">請選擇（${rows.length} 人）</option>${opts}</select></div>`;
 }).join('');
}
function renderPeoplePanel(){
 const q=($('peopleSearch')?.value||'').trim().toLowerCase(),rows=employees().filter(x=>{const name=typeof x==='string'?x:(x.name||''),id=typeof x==='object'?(x.emp_id||''):'';return name.toLowerCase().includes(q)||String(id).toLowerCase().includes(q)});
 $('peopleList').innerHTML=rows.length?rows.map(x=>{const name=typeof x==='string'?x:x.name,id=typeof x==='object'?(x.emp_id||''):'';return `<div class="row">${esc(id)}　<b>${esc(name)}</b></div>`}).join(''):'無符合人員';
 renderSkillPeople();
}
