/* Decode figures with the same image-element path that displays SVG on the site.
 * External markup is never inserted into the extension DOM; export gets PNGs.
 */
(function(scope){
  'use strict';
  function createStore(options={}) {
    const cache=new Map();
    const fetchAsset=options.fetch || ((url,init)=>scope.fetch(url,init));
    const makeImage=options.makeImage || (()=>new scope.Image());
    const makeCanvas=options.makeCanvas || (()=>scope.document.createElement('canvas'));
    const createURL=options.createURL || (blob=>scope.URL.createObjectURL(blob));
    const revokeURL=options.revokeURL || (url=>scope.URL.revokeObjectURL(url));
    const setTimer=options.setTimer || scope.setTimeout.bind(scope);
    const clearTimer=options.clearTimer || scope.clearTimeout.bind(scope);
    async function decode(blob) {
      if(!blob.size)throw new Error('The figure response was empty.');
      if(blob.size>15*1024*1024)throw new Error('The figure is too large to embed.');
      // Some asset servers label SVG as XML/plain text or a generic byte stream.
      // Detect its actual payload; filenames and HTTP MIME labels are not enough.
      const head=await blob.slice(0,4096).text();
      if(/^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(head)&&blob.type!=='image/svg+xml')blob=blob.slice(0,blob.size,'image/svg+xml');
      const url=createURL(blob);const image=makeImage();let timer;
      try {
        await new Promise((resolve,reject)=>{
          image.onload=()=>resolve();
          image.onerror=()=>reject(new Error('The figure is not a supported or valid image ('+(blob.type||'unknown format')+').'));
          timer=setTimer(()=>reject(new Error('The figure took too long to decode.')),20000);
          image.src=url;
        });
        const width=image.naturalWidth,height=image.naturalHeight;
        if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw new Error('The figure has no usable dimensions.');
        if(width*height>25000000)throw new Error('The figure is too large to render.');
        const canvas=makeCanvas();canvas.width=width;canvas.height=height;
        const context=canvas.getContext('2d');
        if(!context)throw new Error('The browser could not prepare the figure for export.');
        context.drawImage(image,0,0);
        const png=canvas.toDataURL('image/png');canvas.width=0;canvas.height=0;
        if(!png.startsWith('data:image/png;base64,'))throw new Error('The figure could not be encoded for the PDF.');
        return png;
      }finally{
        clearTimer(timer);image.onload=null;image.onerror=null;image.src='';revokeURL(url);
      }
    }
    async function load(src) {
      if(/^data:image\/(png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(src))return src;
      let url;try{url=new URL(src);}catch{throw new Error('The figure has an invalid image address.');}
      if(url.origin!=='https://assets.learnosity.com'||url.username||url.password)throw new Error('This figure host is not supported: '+url.hostname);
      if(!cache.has(url.href)) {
        const pending=(async()=>{
          const response=await fetchAsset(url.href,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
          if(!response.ok)throw new Error('Figure download failed ('+response.status+').');
          return decode(await response.blob());
        })();
        cache.set(url.href,pending);
        pending.catch(()=>cache.delete(url.href));
      }
      return cache.get(url.href);
    }
    return {load};
  }
  scope.APReviewImages={createStore};
  if(typeof module!=='undefined')module.exports={createStore};
})(globalThis);
