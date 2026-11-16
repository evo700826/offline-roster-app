/* ZIP 封裝模組：支援 ZIP_STORED 與 ZIP_DEFLATED，並以中央目錄定位資料。 */
function crc32(bytes){let c=0xffffffff;for(let b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function u16(v){return [v&255,(v>>>8)&255]}
function u32(v){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]}
function zipStoredEntries(items){let locals=[],centrals=[],offset=0;for(const [filename,content] of items){let name=new TextEncoder().encode(filename),data=content instanceof Uint8Array?content:new TextEncoder().encode(content),crc=crc32(data);let local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name,...data]);let central=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);locals.push(local);centrals.push(central);offset+=local.length}let centralBytes=new Uint8Array(centrals.reduce((n,x)=>n+x.length,0)),pos=0;for(let c of centrals){centralBytes.set(c,pos);pos+=c.length}let end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(items.length),...u16(items.length),...u32(centralBytes.length),...u32(offset),...u16(0)]);return new Blob([...locals,centralBytes,end],{type:'application/zip'})}
function zipStored(filename,content){return zipStoredEntries([[filename,content]])}
async function unzipStored(file,expectedName){
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(window.fflate&&typeof window.fflate.unzipSync==='function'){
    let files;
    try{files=window.fflate.unzipSync(bytes)}catch(e){throw Error('ZIP 解壓失敗：'+(e.message||String(e)))}
    const entries={};for(const [name,data] of Object.entries(files))entries[name]=data;
    const data=entries[expectedName];if(!data)throw Error('ZIP 缺少必要檔案：'+expectedName);
    return {name:expectedName,data,entries};
  }
  throw Error('ZIP 解壓模組尚未載入。請確認手機網路連線後重新整理，再匯入。');
}
function downloadBlob(blob,name){let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
