/* APP 啟動與介面事件模組
 * 職責：綁定頁面互動事件、啟動本機資料還原及初始畫面。
 * 功能模組本身不負責決定 APP 啟動時機。
 */
function tab(id){
  document.querySelectorAll('.pane').forEach(x=>x.classList.toggle('active',x.id===id));
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));
  if(id==='history')renderHistory();
  if(id==='tempchange')initTempChange();
}
function bindAppEvents(){
  document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
  $('stopCam').onclick=stopCameraScan;
  $('startCam').onclick=async()=>{
    try{
      if(!('BarcodeDetector'in window))throw Error('此 Safari 版本未提供內建 QR 掃描。可用相機掃描工具解碼後貼入文字。');
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
      $('video').srcObject=stream;
      $('video').classList.remove('hidden');
      await $('video').play();
      let det=new BarcodeDetector({formats:['qr_code']});
      let tick=async()=>{
        if(!stream)return;
        try{
          let codes=await det.detect($('video'));
          if(codes.length)await addChunk(codes[0].rawValue);
        }catch(e){$('scanProgress').textContent=e.message}
        requestAnimationFrame(tick);
      };
      tick();
    }catch(e){alert(e.message)}
  };
}
function startApp(){
  bindAppEvents();
  restore();
  if($('emailRecipient'))$('emailRecipient').value=getEmailRecipient();
  setScheduleRange(10);
  renderAll();
  if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
    navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('離線快取註冊失敗',e));
  }
}
startApp();
