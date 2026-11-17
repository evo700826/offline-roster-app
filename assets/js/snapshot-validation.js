/* 共用快照驗證：QR 與 Email ZIP 匯入必須通過相同的資料結構檢查。 */
function validateSnapshotData(snap, expectedExchangeId){
  if(!snap||snap.protocol!==PROTOCOL||snap.kind!=='snapshot')throw Error('不是有效的 Windows 班表快照');
  if(expectedExchangeId&&snap.exchange_id!==expectedExchangeId)throw Error('QR 批次編號與快照不一致');
  if(!snap.data||(!Array.isArray(snap.data.schedule_cells)&&!Array.isArray(snap.data.schedule_entries)))throw Error('Windows 快照缺少 schedule_cells／schedule_entries，為避免顯示錯誤班表，已拒絕匯入');
  if(!snap.base_revision)throw Error('Windows 快照缺少 base_revision，無法安全比對後續異動');
  if(!snap.exchange_id)throw Error('Windows 快照缺少 exchange_id');
  return snap;
}

/* 回傳異動驗證：手機 QR 與 Email ZIP 輸出前使用同一規則。 */
function validateReturnPayload(payload){
  if(!payload||payload.protocol!==PROTOCOL||payload.kind!=='return')throw Error('不是有效的手機回傳資料');
  if(!payload.exchange_id||!payload.base_revision)throw Error('回傳資料缺少交換編號或基準版本');
  if(!Array.isArray(payload.schedule_proposals)||payload.schedule_proposals.length===0)throw Error('回傳資料沒有待審核異動');
  const changedCells=new Set(), assignedPeople=new Set(), changedRestCells=new Set();
  for(let pi=0;pi<payload.schedule_proposals.length;pi++){
    const p=payload.schedule_proposals[pi];
    if(!p||!Array.isArray(p.changes)||p.changes.length===0)throw Error(`第 ${pi+1} 組異動缺少 changes`);
    if(p.base_revision&&p.base_revision!==payload.base_revision)throw Error(`第 ${pi+1} 組異動的基準版本不一致`);
    for(let ci=0;ci<p.changes.length;ci++){
      const c=p.changes[ci];
      if(!c||typeof c.cell_key!=='string'||!c.cell_key.trim())throw Error(`第 ${pi+1} 組第 ${ci+1} 筆異動缺少 cell_key`);
      if(typeof c.old_name!=='string'||typeof c.new_name!=='string')throw Error(`第 ${pi+1} 組第 ${ci+1} 筆異動的人員欄位格式錯誤`);
      if(c.old_name===c.new_name)throw Error(`第 ${pi+1} 組第 ${ci+1} 筆異動前後人員相同`);
      if(c.action&&!['replace','clear','temporary_reassignment'].includes(c.action))throw Error(`第 ${pi+1} 組第 ${ci+1} 筆異動動作不支援`);
      const cellId=String(p.date||'')+'|'+c.cell_key;
      if(changedCells.has(cellId))throw Error('同一日期的班表位置重複異動：'+c.cell_key);
      changedCells.add(cellId);
      const person=String(c.new_name||'').trim();
      if(person){const personId=String(p.date||'')+'|'+person;if(assignedPeople.has(personId))throw Error('同一天有重複安排人員：'+person);assignedPeople.add(personId);}
    }
    if(p.rest_changes!==undefined&&!Array.isArray(p.rest_changes))throw Error(`第 ${pi+1} 組輪休異動格式錯誤`);
    for(let ri=0;ri<(p.rest_changes||[]).length;ri++){
      const r=p.rest_changes[ri];
      if(!r||typeof (r.cell_ref||r.excel_cell)!=='string'||typeof r.old_name!=='string'||typeof r.new_name!=='string')throw Error(`第 ${pi+1} 組第 ${ri+1} 筆輪休異動資料不完整`);
      const restCoord=String(r.cell_ref||r.excel_cell).toUpperCase();
      if(!/^([B-U])13$/.test(restCoord))throw Error('輪休異動位置必須位於第 13 列 B 至 U 欄：'+restCoord);
      if(r.action&&!['temporary_rest_add','temporary_rest_remove'].includes(r.action))throw Error('不支援的輪休異動動作：'+r.action);
      if(r.old_name===r.new_name)throw Error('輪休異動前後人員相同：'+restCoord);
      const restId=String(p.date||'')+'|'+restCoord;
      if(changedRestCells.has(restId))throw Error('同一日期的輪休位置重複異動：'+restCoord);
      changedRestCells.add(restId);
    }
  }
  return payload;
}

/* 以匯入時保存的原始快照比對提案 old_name；此檢查不是 Windows 最新班表的最終衝突判定。 */
function validateReturnAgainstSnapshot(payload, sourceSnapshot){
  validateReturnPayload(payload);
  if(!sourceSnapshot||!sourceSnapshot.data)throw Error('缺少原始班表快照，無法比對修改前值');
  if(payload.base_revision!==sourceSnapshot.base_revision)throw Error('回傳基準版本與原始快照不一致');
  const records=normalizeRecords(sourceSnapshot.data);
  for(let pi=0;pi<payload.schedule_proposals.length;pi++){
    const proposal=payload.schedule_proposals[pi];
    for(let ci=0;ci<proposal.changes.length;ci++){
      const change=proposal.changes[ci];
      let record=records.find(r=>r.key===change.cell_key);
      if(!record){
        const ref=String(change.cell_ref||change.excel_cell||change.cell_key).toUpperCase();
        record=records.find(r=>r.date===proposal.date&&String(r.meta?.cell_ref||r.meta?.cell_key||r.meta?.excel_cell||'').toUpperCase()===ref);
      }
      if(!record)throw Error(`原始快照找不到異動位置：${change.cell_key}；請重新匯入最新快照`);
      const current=String(record.name??'').trim(), expected=String(change.old_name??'').trim();
      if(current!==expected)throw Error(`修改前值不符：${change.cell_key} 原快照為「${current||'（空白）'}」，提案記錄為「${expected||'（空白）'}」`);
    }
    for(let ri=0;ri<(proposal.rest_changes||[]).length;ri++){
      const change=proposal.rest_changes[ri], ref=String(change.cell_ref||change.excel_cell).toUpperCase();
      const record=records.find(r=>r.date===proposal.date&&String(r.meta?.cell_ref||r.meta?.cell_key||r.meta?.excel_cell||'').toUpperCase()===ref);
      if(!record)throw Error(`原始快照找不到輪休位置：${ref}；請重新匯入最新快照`);
      const current=String(record.name??'').trim(), expected=String(change.old_name??'').trim();
      if(current!==expected)throw Error(`輪休修改前值不符：${ref} 原快照為「${current||'（空白）'}」，提案記錄為「${expected||'（空白）'}」`);
    }
  }
  return {valid:true,checked_proposals:payload.schedule_proposals.length};
}
