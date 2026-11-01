'use strict';
// Store tab ownership only. Assignment contents stay in the review tab's memory.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type === 'own-reader' && sender.tab) {
    const owner = sender.tab.id;
    (async () => {
      const reader = await chrome.tabs.get(message.readerId);
      if (reader.openerTabId !== owner || !(reader.pendingUrl || reader.url)?.startsWith('https://apclassroom.collegeboard.org/')) throw new Error('Invalid reading tab.');
      const previous = await chrome.storage.session.get('owner:' + owner);
      if (previous['owner:' + owner] && previous['owner:' + owner] !== reader.id) await chrome.tabs.remove(previous['owner:' + owner]).catch(()=>{});
      await chrome.storage.session.set({['owner:' + owner]:reader.id});
      respond({ok:true});
    })().catch(e=>respond({error:e.message}));
    return true;
  }
  if (message.type === 'release-reader' && sender.tab) {
    (async()=> {
      const key = 'owner:' + sender.tab.id;
      const data = await chrome.storage.session.get(key);
      if (data[key]) await chrome.tabs.remove(data[key]).catch(()=>{});
      await chrome.storage.session.remove(key);
      respond({ok:true});
    })().catch(e=>respond({error:e.message}));
    return true;
  }
});
chrome.tabs.onRemoved.addListener(async id => {
  const key = 'owner:' + id;
  const data = await chrome.storage.session.get(key);
  if (data[key]) await chrome.tabs.remove(data[key]).catch(()=>{});
  await chrome.storage.session.remove(key);
});
