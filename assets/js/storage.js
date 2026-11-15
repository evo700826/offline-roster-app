/* 本機資料儲存模組
 * 職責：集中管理班表快照、待回傳提案與歷史資料的本機保存、載入、舊版遷移及清除。
 * 不負責畫面更新，也不直接修改主程式狀態。
 */
(function(){
  'use strict';
  const LEGACY_KEYS=['roster_phone_177'];
  const VERSION=1;
  function parse(raw){
    if(!raw)return null;
    const value=JSON.parse(raw);
    if(!value || typeof value!=='object' || Array.isArray(value))return null;
    return {
      snapshot:value.snapshot||null,
      baseRevision:typeof value.baseRevision==='string'?value.baseRevision:'',
      proposals:Array.isArray(value.proposals)?value.proposals:[],
      historyItems:Array.isArray(value.historyItems)?value.historyItems:[]
    };
  }
  function load(primaryKey,extraKeys=[]){
    const keys=[primaryKey,...extraKeys,...LEGACY_KEYS].filter((x,i,a)=>x&&a.indexOf(x)===i);
    for(const key of keys){
      try{
        const result=parse(localStorage.getItem(key));
        if(result){
          if(key!==primaryKey){
            try{localStorage.setItem(primaryKey,JSON.stringify(result));}catch(e){}
          }
          return result;
        }
      }catch(e){}
    }
    return null;
  }
  function save(key,state){
    if(!key)throw new Error('缺少本機資料儲存識別碼');
    const payload={
      storage_version:VERSION,
      snapshot:state.snapshot||null,
      baseRevision:state.baseRevision||'',
      proposals:Array.isArray(state.proposals)?state.proposals:[],
      historyItems:Array.isArray(state.historyItems)?state.historyItems:[]
    };
    const serialized=JSON.stringify(payload);
    // 寫入後立即回讀驗證，避免只更新記憶體卻未真正保存。
    localStorage.setItem(key,serialized);
    const check=localStorage.getItem(key);
    if(check!==serialized)throw new Error('本機資料寫入驗證失敗');
    return true;
  }
  function clear(key,extraKeys=[]){
    [key,...extraKeys,...LEGACY_KEYS].filter((x,i,a)=>x&&a.indexOf(x)===i)
      .forEach(k=>localStorage.removeItem(k));
  }
  window.RosterStorage=Object.freeze({load,save,clear,version:VERSION});
})();