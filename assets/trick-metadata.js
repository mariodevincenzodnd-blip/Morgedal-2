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
  function usage(item,parts,resource){
    const original=tidy(String(item.uso||''));
    const cdParts=segments(original).filter(s=>s.kind==='cd');
    let quantity=original;
    for(const p of [...cdParts].reverse())quantity=quantity.slice(0,p.start)+quantity.slice(p.end);
    quantity=quantity.replace(/[,;·\s]+$/,'').trim();
    if(!quantity){quantity=parts.find(p=>p.kind==='quantity')?.label||(resource&&Number.isFinite(resource.max)?String(resource.max):'—');}
    if(/^qu(?:a)?ntit[àa]/i.test(quantity))quantity=quantity.replace(/^qu(?:a)?ntit[àa][’']?\s*/i,'Quantità ');
    else quantity='Quantità '+quantity;
    const cds=[...cdParts,...parts.filter(p=>p.kind==='cd')].map(p=>p.label);
    return quantity+(cds.length?' · '+[...new Set(cds)].join(' · '):'');
  }
  function enhance(panel,state,masterOn,save){
    const selector='[data-rich-arr^="truccetti-"], [data-master-field^="truccetti|"][data-master-field$="|desc"]';
    panel.querySelectorAll(selector).forEach(rich=>{
      if(rich.dataset.trickMetadata)return;
      const index=rich.dataset.richArr?Number(rich.dataset.richArr.split('-')[1]):Number(rich.dataset.masterField.split('|')[1]);
      const item=state.truccetti?.[index],card=rich.closest('.subcard');
      if(!item||!card)return;
      rich.dataset.trickMetadata='1';
      const nameKey=name=>String(name||'').split('\n')[0].toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
      const resource=(state.risorse||[]).find(r=>nameKey(r.nome)===nameKey(item.nome));
      const parts=segments(rich.textContent),value=usage(item,parts,resource);
      removeSegments(rich,parts);
      const tag=card.querySelector('.tag');
      if(!tag)return;
      tag.classList.add('trick-metadata');tag.replaceChildren();
      const category=document.createElement('span');category.textContent='Trucchetto —';tag.append(category);
      let input;
      if(masterOn){
        input=document.createElement('textarea');input.rows=2;input.className='master-uso-input trick-metadata-input';
        input.value=value;input.setAttribute('aria-label','Quantità e CD del Trucchetto');tag.append(input);
        input.addEventListener('input',()=>{item.uso=input.value;item.desc=rich.innerHTML;save();});
        // Capture runs before the existing rich-text handler and its queueSave.
        rich.addEventListener('input',()=>{item.uso=input.value;},true);
      }else{const label=document.createElement('span');label.textContent=value;tag.append(label);}
    });
  }
  root.MorgedalTricks={enhance,segments,usage};
  const style=document.createElement('style');style.textContent=`
    .tag.trick-metadata{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;max-width:100%;white-space:normal;overflow-wrap:anywhere;box-sizing:border-box;line-height:1.5}
    .trick-metadata-input{flex:1 1 220px!important;width:auto!important;min-width:0!important;max-width:100%;box-sizing:border-box;font:inherit!important;line-height:1.5;resize:vertical;white-space:pre-wrap}
  `;document.head.append(style);
})(window);
