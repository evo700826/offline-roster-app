/* APP 啟動與介面事件模組 */
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
      if(!navigator.mediaDevices?.getUserMedia)throw Error('目前瀏覽器無法開啟相機。請使用 Safari 開啟手機版網址，並允許相機權限。');
      if(!window.jsQR && !('BarcodeDetector' in window))throw Error('QR 解碼模組尚未載入，請重新整理手機版網頁。');
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
      const video=$('video');
      video.setAttribute('playsinline','');
      video.srcObject=stream;
      video.classList.remove('hidden');
      await video.play();
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const detector=('BarcodeDetector' in window)?new BarcodeDetector({formats:['qr_code']}):null;
      let busy=false,lastText='',lastAt=0,stopped=false;
      $('scanProgress').textContent='相機已啟動，請將 QR Code 放入畫面中央。';
      const scanFrame=async()=>{
        if(!stream||stopped)return;
        if(!busy&&video.readyState>=2){
          busy=true;
          try{
            let raw='';
            if(detector){
              const found=await detector.detect(video);
              if(found.length)raw=found[0].rawValue||'';
            }
            if(!raw&&window.jsQR){
              const scale=Math.min(1,960/Math.max(video.videoWidth,video.videoHeight));
              canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
              canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
              ctx.drawImage(video,0,0,canvas.width,canvas.height);
              const frame=ctx.getImageData(0,0,canvas.width,canvas.height);
              const decoded=window.jsQR(frame.data,frame.width,frame.height,{inversionAttempts:'attemptBoth'});
              if(decoded)raw=decoded.data||'';
            }
            if(raw&&(raw!==lastText||Date.now()-lastAt>1200)){
              lastText=raw;lastAt=Date.now();
              await addChunk(raw);
            }
          }catch(err){
            $('scanProgress').textContent='掃描中：'+(err.message||'請調整 QR Code 距離與角度');
          }finally{busy=false;}
        }
        if(stream&&!stopped)requestAnimationFrame(scanFrame);
      };
      requestAnimationFrame(scanFrame);
    }catch(e){stopCameraScan();alert(e.message||String(e));}
  };
}
function startApp(){
  bindAppEvents();
  restore();
  if($('emailRecipient'))$('emailRecipient').value=getEmailRecipient();
  setScheduleRange(10);
  renderAll();
  if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
    navigator.serviceWorker.register('./sw.js').then(reg=>reg.update()).catch(e=>console.warn('離線快取更新失敗',e));
  }
}
startApp();
