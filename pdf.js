'use strict';
window.APReviewPDF = {
  async generate(assignment, answers, onProgress=()=>{}) {
    const {PDFDocument,StandardFonts,rgb}=PDFLib;
    const pdf=await PDFDocument.create();pdf.setTitle(assignment.title+' - review');pdf.setAuthor("Henry's ApC-Pdf Convertor");pdf.setCreator("Henry's ApC-Pdf Convertor");
    const font=await pdf.embedFont(StandardFonts.Helvetica);
    const stage=document.querySelector('#pdf-stage');stage.replaceChildren();
    const groups=APReviewCore.groups(assignment.questions);
    if(groups.unknown.length)throw new Error('Classify unscored questions before exporting.');
    const blocks=[];const esc=APReviewCore.escape;
    function block(html,cls){const el=document.createElement('div');el.className='pdf-block '+cls;el.innerHTML=html;stage.append(el);blocks.push(el);return el;}
    for(const [index,title,description,questions] of [
      ['01','Missed questions','Start here. Includes missed questions and partial credit.',groups.missed],
      ['02','Correct questions','Revisit what you already know.',groups.correct]
    ]) {
      block(`<span class="eyebrow">SECTION ${index} / AP CLASSROOM REVIEW</span><h1>${esc(title)}</h1><p class="muted">${esc(assignment.title)}</p><p class="pdf-section-note">${questions.length} question${questions.length===1?'':'s'} · ${description}</p>`,'pdf-section');
      if(!questions.length)block('<p class="pdf-empty">No questions in this section.</p>','pdf-empty');
      for(const q of questions) {
        block(`<h2>Q${q.number} · ${esc(q.title)}</h2><p class="q-meta">${[APReviewCore.STATUS[q.status],q.scoreText?`Score ${q.scoreText}`:'',q.topic?`Topic ${q.topic}`:'',q.skills?`Skill ${q.skills}`:''].filter(Boolean).map(esc).join(' · ')}</p><div class="question-content">${contentHTML(q,answers)}</div>`,'pdf-question');
      }
    }
    await renderMath(stage);await document.fonts.ready;
    for(const image of stage.querySelectorAll('img')) {
      try{await image.decode();}catch{throw new Error('A question image could not be rendered. Read the assignment again.');}
    }
    const W=595.276,H=841.89,margin=35,bodyW=W-margin*2,bottom=H-39;
    let page=null,y=margin;
    function newPage(){page=pdf.addPage([W,H]);y=margin;}
    newPage();
    try {
      for(let i=0;i<blocks.length;i++) {
        const el=blocks[i];onProgress(`Building PDF · ${i+1} of ${blocks.length}`);
        if(el.classList.contains('pdf-section')&&i>0&&y>margin)newPage();
        const rect=el.getBoundingClientRect();
        const intact=[...el.querySelectorAll('.option,table,img,h2')].map(node=>{
          const r=node.getBoundingClientRect();return {start:Math.floor((r.top-rect.top)*2),end:Math.ceil((r.bottom-rect.top)*2)};
        });
        const canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff',logging:false,useCORS:false,allowTaint:false,windowWidth:1000});
        const ratio=bodyW/canvas.width, totalH=canvas.height*ratio;
        // Normal questions remain intact; exceptionally long questions continue
        // on the next page at whitespace between rendered lines or figures.
        if(y>margin&&y+totalH>bottom)newPage();
        let offset=0;
        while(offset<canvas.height) {
          if(bottom-y<35)newPage();
          const capacity=Math.floor((bottom-y)/ratio);
          let end=Math.min(canvas.height,offset+capacity);
          if(end<canvas.height) {
            const fullPageCapacity=Math.floor((bottom-margin)/ratio);
            // Prefer moving an entire option, chart, or table to the next page.
            // A large item that exceeds a full page can still continue safely.
            let changed=true;
            while(changed){changed=false;for(const box of intact) {
              if(box.end-box.start<fullPageCapacity&&box.start>offset+60&&box.start<end&&box.end>end){end=box.start;changed=true;}
            }}
            const ctx=canvas.getContext('2d',{willReadFrequently:true});
            let found=false;
            // Search near the page edge for a white row. Keep text glyphs whole.
            for(let row=end;row>Math.max(offset+100,end-180);row--) {
              const pixels=ctx.getImageData(5,row-1,canvas.width-10,1).data;
              let ink=0;for(let p=0;p<pixels.length;p+=4)if(pixels[p]<235||pixels[p+1]<235||pixels[p+2]<235)ink++;
              if(ink<3){end=row;found=true;break;}
            }
            if(!found&&offset===0&&y>margin){newPage();continue;}
          }
          const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=end-offset;
          slice.getContext('2d').drawImage(canvas,0,offset,canvas.width,end-offset,0,0,canvas.width,end-offset);
          const image=await pdf.embedPng(slice.toDataURL('image/png'));
          const h=slice.height*ratio;page.drawImage(image,{x:margin,y:H-y-h,width:bodyW,height:h});
          y+=h;offset=end;if(offset<canvas.height)newPage();slice.width=0;slice.height=0;
        }
        canvas.width=0;canvas.height=0;y+=6;
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      const pages=pdf.getPages();pages.forEach((p,i)=>{
        p.drawLine({start:{x:margin,y:27},end:{x:W-margin,y:27},thickness:.4,color:rgb(.84,.87,.87)});
        p.drawText("Henry's ApC-Pdf Convertor",{x:margin,y:15,size:7,font,color:rgb(.42,.46,.5)});
        const count=`${i+1} / ${pages.length}`;p.drawText(count,{x:W-margin-font.widthOfTextAtSize(count,7),y:15,size:7,font,color:rgb(.42,.46,.5)});
      });
      return await pdf.save();
    }finally{stage.replaceChildren();}
  }
};
