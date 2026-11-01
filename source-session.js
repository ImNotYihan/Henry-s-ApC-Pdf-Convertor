/* Reuse the already signed-in source tab. Never create, reload, or close it. */
(function (scope) {
  'use strict';
  class SourceSession {
    constructor(api, core, options={}) {
      this.api=api;this.core=core;this.tabId=null;this.base=null;this.original=null;this.cancelled=false;
      this.sleep=options.sleep || (ms=>new Promise(resolve=>setTimeout(resolve,ms)));
      this.now=options.now || Date.now;
    }
    cancel(){this.cancelled=true;}
    check(){if(this.cancelled)throw new Error('Reading cancelled. Your AP Classroom tab stays open.');}
    async open(tabId) {
      if(!Number.isInteger(tabId)||tabId<=0)throw new Error('Open the extension from your existing AP Classroom results tab.');
      let source;
      try{source=await this.api.tabs.get(tabId);}catch{throw new Error('The original AP Classroom tab was closed. Open the extension again from your results tab.');}
      this.base=this.core.assignmentUrl(source.url);
      if(!this.base)throw new Error('The source tab is no longer a completed assignment. Open the extension from your existing results tab.');
      this.tabId=tabId;
      await this.inject();this.original=await this.call('view');
    }
    async guard() {
      let tab;
      try{tab=await this.api.tabs.get(this.tabId);}catch{throw new Error('The original AP Classroom tab was closed. Open the extension again from your results tab.');}
      if(this.core.assignmentUrl(tab.pendingUrl || tab.url)!==this.base)throw new Error('The source tab moved away from this assignment. Reading stopped; your page was left as it is.');
      return tab;
    }
    async inject() {
      await this.guard();
      await this.api.scripting.executeScript({target:{tabId:this.tabId},files:['core.js','reader.js']});
    }
    async call(method,args=[]) {
      await this.guard();
      const [result]=await this.api.scripting.executeScript({target:{tabId:this.tabId},func:(method,args,base)=>{
        if(!globalThis.APReviewReader)return {ok:false,error:'The page reader is not ready yet.'};
        if(globalThis.APReviewCore.assignmentUrl(location.href)!==base)return {ok:false,error:'The source tab moved away from this assignment.'};
        try{return {ok:true,value:globalThis.APReviewReader[method](...args)};}catch(e){return {ok:false,error:e.message};}
      },args:[method,args,this.base]});
      if(!result?.result?.ok)throw new Error(result?.result?.error || 'The existing assignment page could not be read.');
      return result.result.value;
    }
    async waitFor(read,message,timeout=45000,restoring=false) {
      const end=this.now()+timeout;let lastError;
      while(this.now()<end) {
        if(!restoring)this.check();
        const tab=await this.guard();
        try {
          if(tab.status==='complete') {
            await this.inject();const result=await read();if(result)return result;
          }
        }catch(e){lastError=e;if(/moved away|was closed/.test(e.message))throw e;}
        await this.sleep(250);
      }
      throw new Error(message+(lastError?'\n'+lastError.message:''));
    }
    async clickRoute(url,restoring=false) {
      if(!restoring)this.check();
      if(this.core.assignmentUrl(url)!==this.base)throw new Error('This link is outside the current assignment.');
      await this.inject();
      if(!await this.call('navigate',[url]))return false;
      await this.waitFor(async()=>((await this.call('view')).url===url),
        'The existing page did not finish opening the question. Return to Results Overview and try again.',15000,restoring);
      return true;
    }
    async getOverview() {
      let result=await this.call('overview');
      if(!result.questions.length) {
        const view=await this.call('view');
        if(view.url!==this.base&&!await this.clickRoute(this.base))throw new Error('The Results Overview link is not available on this page. Open Results Overview in this same tab, then try again.');
        await this.call('showQuestions');
        result=await this.waitFor(async()=>{
          const overview=await this.call('overview');return overview.questions.length?overview:null;
        },'The question table did not load in your existing tab. Open the Questions tab and try again.');
      }
      return result;
    }
    async openQuestion(url,restoring=false) {
      if(await this.clickRoute(url,restoring))return;
      // Use the site's own breadcrumbs and question links, preserving its session.
      if(!await this.clickRoute(this.base,restoring))throw new Error('The question link is not available in your existing tab. Open Results Overview in this tab and try again.');
      await this.waitFor(async()=>{
        const overview=await this.call('overview');return overview.questions.length?overview:null;
      },'The question list did not load in the existing tab.',15000,restoring);
      if(!await this.clickRoute(url,restoring))throw new Error('This question is not available in the existing page. No new AP Classroom tab was opened.');
    }
    async restore() {
      if(!this.original||this.tabId===null)return '';
      try {
        await this.guard();
        const current=await this.call('view');
        if(current.url!==this.original.url) {
          if(this.original.url===this.base) {
            if(!await this.clickRoute(this.base,true))throw new Error('The original overview link is unavailable.');
            await this.waitFor(async()=>{
              const overview=await this.call('overview');return overview.questions.length?overview:null;
            },'The original overview did not finish rendering.',15000,true);
          }else await this.openQuestion(this.original.url,true);
        }
        await this.call('restoreView',[this.original]);
        return '';
      }catch(e){return 'Your AP Classroom tab was kept open. Its original view could not be restored: '+e.message;}
      finally{this.original=null;}
    }
  }
  scope.APReviewSourceSession=SourceSession;
  if(typeof module!=='undefined')module.exports=SourceSession;
})(globalThis);
