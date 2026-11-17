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
      if(!navigator.mediaDevices?.getUserMedia)throw Error('目前瀏覽器無法開啟相機。請用 Safari 開啟手機版網址，並允許相機權限。');
      if(!window.jsQR && !('BarcodeDetector' in window))throw Error('QR 解碼模組尚未載入，請重新整理手機版網頁。');
      $('scanProgress').textContent='正在啟動後鏡頭…';
      stream=await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{
          facingMode:{ideal:'environment'},
          width:{ideal:1920},height:{ideal:1080},
          frameRate:{ideal:24,max:30}
        }
      });
      const video=$('video');
      video.setAttribute('playsinline','');
      video.setAttribute('autoplay','');
      video.muted=true;
      video.srcObject=stream;
      video.classList.remove('hidden');
      await video.play();
      const track=stream.getVideoTracks()[0];
      // 手機支援時啟用連續自動對焦；不支援則略過，不影響掃描。
      try{
        const caps=track.getCapabilities?.()||{};
        const advanced={};
        if(caps.focusMode?.includes('continuous'))advanced.focusMode='continuous';
        if(Object.keys(advanced).length)await track.applyConstraints({advanced:[advanced]});
      }catch(_){}
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const detector=('BarcodeDetector' in window)?new BarcodeDetector({formats:['qr_code']}):null;
      let busy=false,lastText='',lastAt=0,stopped=false,lastScan=0,frames=0;
      $('scanProgress').textContent='後鏡頭已啟動。請讓 QR Code 完整進入畫面，保持手機穩定約 1–2 秒。';
      const scanFrame=async(now)=>{
        if(!stream||stopped)return;
        if(!busy&&video.readyState>=2&&video.videoWidth>0&&now-lastScan>180){
          busy=true;lastScan=now;frames++;
          try{
            let raw='';
            // 先以 jsQR 直接解原始相機影像，避免原生辨識器在部分 Safari 上漏掃。
            if(window.jsQR){
              const scale=Math.min(1,1920/Math.max(video.videoWidth,video.videoHeight));
              canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
              canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
              ctx.drawImage(video,0,0,canvas.width,canvas.height);
              const frame=ctx.getImageData(0,0,canvas.width,canvas.height);
              const decoded=window.jsQR(frame.data,frame.width,frame.height,{inversionAttempts:'attemptBoth'});
              if(decoded)raw=decoded.data||'';
            }
            if(!raw&&detector){
              const found=await detector.detect(video);
              if(found.length)raw=found[0].rawValue||'';
            }
            if(raw&&(raw!==lastText||Date.now()-lastAt>900)){
              lastText=raw;lastAt=Date.now();
              $('scanProgress').textContent='已辨識 QR，正在驗證資料…';
              await addChunk(raw);
            }else if(!raw&&frames%20===0){
              $('scanProgress').textContent='相機正常（'+video.videoWidth+'×'+video.videoHeight+'），尚未辨識到 QR。請放大 QR、擦拭鏡頭並避免反光。';
            }
          }catch(err){
            $('scanProgress').textContent='讀取到 QR 但資料處理失敗：'+(err.message||String(err));
          }finally{busy=false;}
        }
        if(stream&&!stopped)requestAnimationFrame(scanFrame);
      };
      requestAnimationFrame(scanFrame);
    }catch(e){stopCameraScan();alert(e.message||String(e));}
  };
}
async function startApp(){
  bindAppEvents();
  await restore();
  if($('emailRecipient'))$('emailRecipient').value=getEmailRecipient();
  setScheduleRange(10);
  renderAll();
  if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
    navigator.serviceWorker.register('./sw.js').then(reg=>reg.update()).catch(e=>console.warn('離線快取更新失敗',e));
  }
}
startApp();
