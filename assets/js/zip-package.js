/* ZIP 封裝模組：支援 ZIP_STORED 與 ZIP_DEFLATED，並以中央目錄定位資料。 */
function crc32(bytes){let c=0xffffffff;for(let b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function u16(v){return [v&255,(v>>>8)&255]}
function u32(v){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]}
function zipStoredEntries(items){let locals=[],centrals=[],offset=0;for(const [filename,content] of items){let name=new TextEncoder().encode(filename),data=content instanceof Uint8Array?content:new TextEncoder().encode(content),crc=crc32(data);let local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name,...data]);let central=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);locals.push(local);centrals.push(central);offset+=local.length}let centralBytes=new Uint8Array(centrals.reduce((n,x)=>n+x.length,0)),pos=0;for(let c of centrals){centralBytes.set(c,pos);pos+=c.length}let end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(items.length),...u16(items.length),...u32(centralBytes.length),...u32(offset),...u16(0)]);return new Blob([...locals,centralBytes,end],{type:'application/zip'})}
function zipStored(filename,content){return zipStoredEntries([[filename,content]])}
async function unzipStored(file,expectedName){
  const b=new Uint8Array(await file.arrayBuffer()),v=new DataView(b.buffer,b.byteOffset,b.byteLength),entries={};
  // 從檔尾尋找 End of Central Directory，避免壓縮資料描述符造成錯位。
  let eocd=-1,lower=Math.max(0,b.length-22-65535);
  for(let i=b.length-22;i>=lower;i--){if(v.getUint32(i,true)===0x06054b50){eocd=i;break}}
  if(eocd<0)throw Error('ZIP 結構錯誤：找不到中央目錄');
  if(v.getUint16(eocd+4,true)!==0||v.getUint16(eocd+6,true)!==0)throw Error('目前不支援跨磁碟 ZIP');
  const count=v.getUint16(eocd+10,true),centralSize=v.getUint32(eocd+12,true),centralOffset=v.getUint32(eocd+16,true);
  if(count===0xffff||centralSize===0xffffffff||centralOffset===0xffffffff)throw Error('目前不支援 ZIP64 格式，請重新匯出一般 ZIP');
  if(centralOffset+centralSize>eocd)throw Error('ZIP 中央目錄位置錯誤');
  let off=centralOffset;
  for(let k=0;k<count;k++){
    if(off+46>b.length||v.getUint32(off,true)!==0x02014b50)throw Error('ZIP 中央目錄資料損毀');
    const flags=v.getUint16(off+8,true),method=v.getUint16(off+10,true),crc=v.getUint32(off+16,true),compressedSize=v.getUint32(off+20,true),size=v.getUint32(off+24,true),nlen=v.getUint16(off+28,true),elen=v.getUint16(off+30,true),clen=v.getUint16(off+32,true),localOffset=v.getUint32(off+42,true);
    const nameBytes=b.slice(off+46,off+46+nlen),name=new TextDecoder().decode(nameBytes);
    if(flags&1)throw Error('ZIP 使用密碼加密，手機版無法匯入');
    if(compressedSize===0xffffffff||size===0xffffffff||localOffset===0xffffffff)throw Error('目前不支援 ZIP64 格式');
    if(localOffset+30>b.length||v.getUint32(localOffset,true)!==0x04034b50)throw Error('ZIP 本機檔案標頭錯誤');
    const localNameLen=v[localOffset+26]|(v[localOffset+27]<<8),localExtraLen=v[localOffset+28]|(v[localOffset+29]<<8),dataStart=localOffset+30+localNameLen+localExtraLen,dataEnd=dataStart+compressedSize;
    if(dataEnd>b.length)throw Error('ZIP 壓縮資料長度錯誤');
    const compressed=b.slice(dataStart,dataEnd);let data;
    if(method===0)data=compressed;
    else if(method===8){
      if(typeof DecompressionStream==='undefined')throw Error('此 iPhone Safari 不支援 ZIP 解壓，請更新 iOS/Safari 後再匯入');
      try{const ds=new DecompressionStream('deflate-raw');data=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(ds)).arrayBuffer())}
      catch(err){throw Error('ZIP DEFLATE 解壓失敗：'+(err.message||String(err)))}
    }else throw Error('ZIP 使用不支援的壓縮方法（'+method+'），請重新匯出一般 ZIP');
    if(data.length!==size||crc32(data)!==crc)throw Error('ZIP 資料完整性檢查失敗：'+name);
    entries[name]=data;off+=46+nlen+elen+clen;
  }
  const data=entries[expectedName];if(!data)throw Error('ZIP 缺少必要檔案：'+expectedName);
  return {name:expectedName,data,entries};
}
function downloadBlob(blob,name){let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
