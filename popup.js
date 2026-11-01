'use strict';
(async () => {
  const button = document.querySelector('#read');
  const [source] = await chrome.tabs.query({active:true,currentWindow:true});
  const base = APReviewCore.assignmentUrl(source?.url);
  if (!base) {
    document.querySelector('#source-title').textContent = 'Open an assignment';
    document.querySelector('#source-note').textContent = 'Go to a completed AP Classroom assignment and open Results Overview or Question Details.';
    return;
  }
  document.querySelector('#source-title').textContent = 'AP Classroom results';
  document.querySelector('#source-note').textContent = 'Ready to read. You will confirm the preview before exporting.';
  try {
    const [result] = await chrome.scripting.executeScript({target:{tabId:source.id},func:()=>({title:document.querySelector('#mainHeading,h1')?.textContent})});
    if (result?.result?.title) document.querySelector('#source-title').textContent=result.result.title;
  } catch { /* The full read provides actionable errors. */ }
  button.disabled=false;
  button.addEventListener('click', async()=>{
    button.disabled=true;
    try {
      await chrome.tabs.create({url:chrome.runtime.getURL('review.html')+'?source='+source.id});
      window.close();
    } catch (e) {
      const error=document.querySelector('#popup-error'); error.hidden=false;error.textContent=e.message;button.disabled=false;
    }
  });
})().catch(e=>{document.querySelector('#source-title').textContent='Unable to access this tab';document.querySelector('#source-note').textContent=e.message;});
