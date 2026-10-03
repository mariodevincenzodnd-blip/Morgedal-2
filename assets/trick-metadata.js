/* Presentation only: never migrate or save a character on page load.
 * Metadata is committed through the existing editor/save path only on an edit.
 */
(function(root){
  'use strict';
  const tidy = text => text.replace(/\s+/g,' ').trim();
  function segments(text){
    const found=[];
    const add=(pattern,kind,label)=>{
      for(const match of text.matchAll(pattern)){
        const start=match.index,end=start+match[0].length;
        if(found.some(s=>start<s.end&&end>s.start))continue;
        found.push({start,end,kind,label:label?label(match,text):tidy(match[0])});
      }
    };
    // Keep the whole qualifier, not just its number. Unknown CDs are not inferred.
    add(/\bCD\s+per\s+uccidere\s*\d+\s*(?:\([^)]*\))?/gi,'cd');
    add(/\(?\bCD\s*\d+\s+PER\s+USARE\s+RUNE\)?/gi,'cd',m=>tidy(m[0]).replace(/^\(|\)$/g,''));
    add(/\bCD\s+Variabile[^.()\n]*/gi,'cd');
    add(/(?:la\s+)?CD\s+sale\s+a\s*\d+/gi,'cd',(m,text)=>{
      const condition=text.slice(0,m.index).match(/Caos\s+(?:lvl|livello)\s*\d+(?![\s\S]*Caos\s+(?:lvl|livello)\s*\d+)/i);
      return 'CD '+m[0].match(/\d+/)[0]+(condition?' ('+tidy(condition[0])+')':' — '+tidy(m[0]));
    });
    add(/\bCD\s*:?\s*\d+(?:\s*\([^)]*\))?/gi,'cd',(m,text)=>{
      const ts=text.slice(Math.max(0,m.index-60),m.index).match(/TS\s+([\p{L}]+)\s*$/iu);
      return tidy(m[0])+(ts?' (TS '+ts[1]+')':'');
    });
    add(/\(?\bQ(?:u|U)(?:a|A)?ntit[àa](?:[’']|\s)*\s*[-:]?\s*\d+\s*-?\)?/gi,'quantity',m=>tidy(m[0]).replace(/^\(|\)$/g,''));
    add(/(?:\[|\()Max\s+\d+\s+(?:x|ogni)\s+ripos[oi]\s+lungh?[oi](?:\]|\))/gi,'quantity',m=>m[0].slice(1,-1).replace(/^Max\s+/i,''));
    add(/\(due ogni riposo lungo\)/gi,'quantity',m=>m[0].slice(1,-1));
    return found.sort((a,b)=>a.start-b.start);
  }
  // Use DOM ranges so a CD split across styled spans is recognized without
  // stripping bold, color, font, links, or markup from the remaining text.
  function removeSegments(el,parts){
    for(const part of [...parts].reverse()){
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];
      let node,total=0;
      while((node=walker.nextNode())){nodes.push({node,start:total,end:total+node.length});total+=node.length;}
      const a=nodes.find(n=>part.start>=n.start&&part.start<n.end);
      const b=nodes.find(n=>part.end>n.start&&part.end<=n.end);
      if(!a||!b)continue;
      const range=document.createRange();range.setStart(a.node,part.start-a.start);range.setEnd(b.node,part.end-b.start);range.deleteContents();
    }
    el.querySelectorAll('p,span,b,strong,i,em,u,font').forEach(node=>{
      if(!node.textContent.trim()&&!node.querySelector('img,br'))node.remove();
    });
  }
  function usage(item,parts){
    const original=tidy(String(item.uso||''));
    const cdParts=segments(original).filter(s=>s.kind==='cd');
    const cds=[...cdParts,...parts.filter(p=>p.kind==='cd')].map(p=>p.label);
    return [...new Set(cds)].join(' · ');
  }
  function withoutCD(text){
    let value=String(text||'');
    for(const p of segments(value).filter(s=>s.kind==='cd').reverse())value=value.slice(0,p.start)+value.slice(p.end);
    return tidy(value).replace(/^[,;·\s]+|[,;·\s]+$/g,'');
  }
  function usageNote(text){
    // Counts belong to the existing pips/controls, not to the category badge.
    // Preserve recharge rules and conditions separately, without inferring counts.
    return withoutCD(text).replace(/^qu(?:a)?ntit[àa][’']?\s*[-:]?\s*/i,'')
      .replace(/^\d+\s*(?:x\s*|[-·]\s*|$)/i,'').replace(/^[-·\s]+|[-·\s]+$/g,'');
  }
  function enhance(panel,state,masterOn,save){
    const selector='[data-rich-arr^="truccetti-"], [data-master-field^="truccetti|"][data-master-field$="|desc"]';
    panel.querySelectorAll(selector).forEach(rich=>{
      if(rich.dataset.trickMetadata)return;
      const index=rich.dataset.richArr?Number(rich.dataset.richArr.split('-')[1]):Number(rich.dataset.masterField.split('|')[1]);
      const item=state.truccetti?.[index],card=rich.closest('.subcard');
      if(!item||!card)return;
      rich.dataset.trickMetadata='1';
      const tag=card.querySelector('.tag');
      if(!tag)return;
      const parts=segments(rich.textContent),value=usage(item,parts);
      const removed=parts.filter(p=>p.kind==='cd'||card.querySelector('[data-respip]'));
      removeSegments(rich,removed);
      const originalUsage=withoutCD(item.uso);
      const quantities=removed.filter(p=>p.kind==='quantity').map(p=>p.label);
      const preserved=[originalUsage,...quantities.filter(q=>!originalUsage.includes(q))].filter(Boolean).join(' · ');
      tag.classList.add('trick-metadata');tag.replaceChildren();
      const category=document.createElement('span');category.textContent='Trucchetto';tag.append(category);
      const note=[...new Set([originalUsage,...quantities].map(usageNote).filter(Boolean))].join(' · ');
      if(note){
        const info=document.createElement('div');info.className='trick-usage-note';info.textContent=note;
        rich.before(info);
      }
      let input;
      if(masterOn){
        input=document.createElement('span');input.contentEditable='true';input.className='trick-metadata-input';
        input.textContent=value;input.setAttribute('role','textbox');input.setAttribute('aria-label','CD del Trucchetto');tag.append(input);
        const commitCD=()=>{item.uso=[preserved,tidy(input.textContent)].filter(Boolean).join(' · ');};
        input.addEventListener('keydown',e=>{if(e.key==='Enter')e.preventDefault();});
        input.addEventListener('input',()=>{commitCD();item.desc=rich.innerHTML;save();});
        // Capture runs before the existing rich-text handler and its queueSave.
        rich.addEventListener('input',commitCD,true);
      }else if(value){const label=document.createElement('span');label.textContent=value;tag.append(label);}
    });
  }
  root.MorgedalTricks={enhance,segments,usage};
  const style=document.createElement('style');style.textContent=`
    .tag.trick-metadata{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px 8px;width:fit-content;max-width:100%;white-space:normal;overflow-wrap:anywhere;box-sizing:border-box;line-height:1.5}
    .trick-metadata-input{min-width:2ch;max-width:100%;box-sizing:border-box;font:inherit;line-height:1.5;white-space:pre-wrap;border:1px solid currentColor;border-radius:4px;padding:0 4px}
    .trick-metadata-input:empty:before{content:'CD';opacity:.5;pointer-events:none}
    .trick-usage-note{font-size:.85em;opacity:.85;margin:4px 0;overflow-wrap:anywhere}
  `;document.head.append(style);
})(window);
