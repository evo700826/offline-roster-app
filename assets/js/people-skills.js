/* 人員與技能唯讀面板：每項技能各自一個下拉選單，讀取 Windows 原始順位資料。 */
function skillTask(x){return String(x.task||x.skill||x.skill_name||'').trim()}
function skillName(x){return String(x.name||x.employee_name||x.person_name||'').trim()}
function skillRank(x){const n=Number(x.rank??x.priority??x.order??x.sequence);return Number.isFinite(n)?n:999999}
function skillGroup(task){const t=String(task||'');if(/^市/.test(t))return 0;if(/^村/.test(t))return 1;if(/^包/.test(t))return 2;if(/^快早/.test(t))return 3;if(/^快晚收/.test(t)||/^快晚/.test(t)||/^收/.test(t))return 4;if(/^接/.test(t))return 5;if(/^內勤/.test(t))return 6;return 7}
/* Windows 完整備份會同時提供 skills:{task,employees[]} 與 skill_rank_rows 原始順位表。
   必須優先讀取 skill_rank_rows；舊版只讀 skills 會把 employees 陣列誤當成沒有姓名，造成全部顯示 0 人。 */
function normalizedSkillRows(){
 const d=data(),raw=Array.isArray(d.skill_rank_rows)&&d.skill_rank_rows.length?d.skill_rank_rows:(Array.isArray(d.skills)?d.skills:[]);
 const out=[];
 raw.forEach(x=>{
  if(!x||typeof x!=='object')return;
  const task=skillTask(x);if(!task)return;
  const directName=skillName(x);
  if(directName){out.push({...x,task,name:directName});return}
  const people=Array.isArray(x.employees)?x.employees:(Array.isArray(x.people)?x.people:[]);
  people.forEach((p,i)=>{
   if(typeof p==='string')out.push({task,name:p,rank:i+1});
   else if(p&&typeof p==='object')out.push({...p,task,name:skillName(p)||String(p.employee||p.person||'')});
  });
 });
 return out.filter(x=>skillTask(x)&&skillName(x));
}
function skillCategory(task){
 const t=String(task||'').trim();
 if(/^市(?:[1-9]|[12]\\d|3[0-8])$/.test(t))return '市';
 if(/^村(?:[1-9]|[12]\\d|3[0-4])$/.test(t))return '村';
 if(/^包(?:[1-9]|1[0-6])$/.test(t)||/^快早/.test(t)||/^快晚/.test(t))return '包';
 if(/^(?:接|收)/.test(t))return '收';
 if(/^內勤/.test(t))return '內';
 return '其他';
}
const SKILL_CATEGORY_ORDER=['市','村','包','收','內','其他'];
let activeSkillCategory='市';
function orderedSkillTasks(){return [...new Set(normalizedSkillRows().map(skillTask))].sort((a,b)=>SKILL_CATEGORY_ORDER.indexOf(skillCategory(a))-SKILL_CATEGORY_ORDER.indexOf(skillCategory(b))||a.localeCompare(b,'zh-Hant',{numeric:true}))}
function skillEmployeeLabel(x,index){const name=skillName(x),emp=employees().find(e=>(typeof e==='string'?e:e.name)===name);const id=(typeof emp==='object'&&emp?emp.emp_id:'')||x.emp_id||x.employee_id||'';const rank=x.rank??x.priority??x.order??x.sequence??(index+1);return `${id?String(id)+'　':''}${name}`}
function renderSkillOptions(){renderSkillPeople()}
function renderSkillPeople(){
 const box=$('skillTaskList');if(!box)return;
 const rows=normalizedSkillRows(),tasks=orderedSkillTasks();
 if(!rows.length){box.innerHTML='<div class="skill-empty">尚未匯入有效的技能順位資料（請重新匯入 Windows 完整備份或班表資料）</div>';return}
 const counts=Object.fromEntries(SKILL_CATEGORY_ORDER.map(cat=>[cat,tasks.filter(t=>skillCategory(t)===cat).length]));
 if(!tasks.some(t=>skillCategory(t)===activeSkillCategory))activeSkillCategory=SKILL_CATEGORY_ORDER.find(cat=>counts[cat]>0)||'其他';
 const visible=tasks.filter(t=>skillCategory(t)===activeSkillCategory);
 const nav=`<nav class="skill-side-tabs" aria-label="技能分類">${SKILL_CATEGORY_ORDER.map(cat=>`<button type="button" class="skill-side-tab ${cat===activeSkillCategory?'active':''}" data-skill-category="${cat}">${cat}</button>`).join('')}</nav>`;
 const list=visible.map((task,ti)=>{
  const people=rows.filter(x=>skillTask(x)===task).sort((x,y)=>skillRank(x)-skillRank(y)||skillName(x).localeCompare(skillName(y),'zh-Hant'));
  const opts=people.map((x,i)=>`<option value="${esc(skillName(x))}">${esc(skillEmployeeLabel(x,i))}</option>`).join('');
  return `<div class="skill-task-row"><label for="skillTask_${ti}">${esc(task)}</label><select id="skillTask_${ti}" aria-label="${esc(task)}人員名單"><option value="">請選擇（${people.length} 人）</option>${opts}</select></div>`;
 }).join('');
 box.innerHTML=nav+`<div class="skill-category-content">${list||'<div class="skill-empty">此分類目前沒有技能項目</div>'}</div>`;
 box.querySelectorAll('[data-skill-category]').forEach(btn=>btn.addEventListener('click',()=>{activeSkillCategory=btn.dataset.skillCategory;renderSkillPeople()}));
}
function renderPeoplePanel(){
 const q=($('peopleSearch')?.value||'').trim().toLowerCase(),rows=employees().filter(x=>{const name=typeof x==='string'?x:(x.name||''),id=typeof x==='object'?(x.emp_id||''):'';return name.toLowerCase().includes(q)||String(id).toLowerCase().includes(q)});
 $('peopleList').innerHTML=rows.length?rows.map(x=>{const name=typeof x==='string'?x:x.name,id=typeof x==='object'?(x.emp_id||''):'';return `<div class="row">${esc(id)}　<b>${esc(name)}</b></div>`}).join(''):'無符合人員';
 renderSkillPeople();
}
