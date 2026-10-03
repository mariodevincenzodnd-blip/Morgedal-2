/* Katan pilot: presentation only. Counters keep their original STATE indices.
 * Opening panels never queues a save and full descriptions remain untouched. */
(function(root){
  'use strict';
  const sections = new Map(), items = new WeakMap();
  // Display summaries grounded in the current Drive descriptions. A changed
  // description falls back to an excerpt, so a Master edit cannot leave stale rules.
  const previews = {
    recuperareenergie:[431145564,'Recupera 1d20 o 2d10 PF.'],
    contrattacco:[2197118312,'Tiro contrapposto al tiro per colpire del nemico: se vinci, contrattacchi. Richiede un attacco tenuto in riserva.'],
    duellanteabile:[1628074557,'Se il primo colpo fallisce e il secondo colpisce, sommi al secondo anche i danni del primo.'],
    superabilita:[1302040401,'Potenzia una caratteristica per tutta la durata dello scontro. Comprende l’uso simultaneo di tutte le caratteristiche.'],
    cinturatelecinetica:[2101669140,'Cintura orbitante con 6 oggetti: sostituisci un attacco per lanciarne 2. Comprende il lancio simultaneo degli oggetti rimasti.'],
    implosionetelecinetica:[1668575393,'Comprime il nemico: 8d6 per singolo utilizzo. Comprende un colpo concentrato da 20d6 che usa entrambe le cariche.'],
    velotelecinetico:[1300159573,'Protezione costante: +1 CA, con mantenimento di uno slot al riposo lungo. Comprende il potenziamento a +3 CA.'],
    bastionedellavolonta:[107214507,'Barriera telecinetica su sé stessi, un alleato o un punto del campo. Comprende gli assetti Portatile e Bastione e la deviazione dei colpi.']
  };
  function fingerprint(value){let n=2166136261;for(const c of String(value||'')){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
  const key = value => String(value || '').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const text = html => { const el=document.createElement('div'); el.innerHTML=String(html||''); return el.textContent.replace(/\s+/g,' ').trim(); };
  function excerpt(html){
    const value=text(html), sentence=value.match(/^.*?[.!?](?=\s|$)/)?.[0] || value;
    if(sentence.length<=260)return sentence;
    return sentence.slice(0,260).replace(/\s+\S*$/,'')+'…';
  }
  function capture(panel){
    if(!panel)return;
    panel.querySelectorAll('[data-power-section]').forEach(el=>sections.set(el.dataset.powerSection,el.open));
    panel.querySelectorAll('[data-power-item]').forEach(el=>{if(el.__powerItem)items.set(el.__powerItem,el.querySelector('.power-toggle').getAttribute('aria-expanded')==='true');});
  }
  function enhance(panel,state,masterOn,render,save){
    if(!panel || panel.querySelector('[data-power-section]'))return;
    const cards=Array.from(panel.children), byTitle=title=>cards.find(el=>el.querySelector('h2')?.textContent.trim().startsWith(title));
    const tricks=byTitle('TRUCCHETTI'), abilities=byTitle('ABILITÀ'), passives=byTitle('PASSIVE'), limited=byTitle('Utilizzi Limitati');
    if(!tricks)return;
    const resources=new Map();
    limited?.querySelectorAll('.tracker').forEach(tracker=>{
      const pip=tracker.querySelector('[data-respip]'), field=tracker.querySelector('[data-master-field^="risorse|"]');
      const index=pip?Number(pip.dataset.respip.split('-')[0]):field?Number(field.dataset.masterField.split('|')[1]):-1;
      if(index>=0)resources.set(index,tracker);
    });
    function compactPips(full){
      const group=document.createElement('div');group.className='power-compact-uses';
      full.querySelectorAll('[data-respip]').forEach(original=>{
        const clone=original.cloneNode(true), [index,p]=clone.dataset.respip.split('-').map(Number);
        clone.type='button';clone.setAttribute('aria-label',(state.risorse[index]?.nome||'Risorsa')+' — utilizzo '+(p+1));
        clone.setAttribute('aria-pressed',String(p<(state.risorse[index]?.used||0)));
        original.type='button';original.setAttribute('aria-label',clone.getAttribute('aria-label'));original.setAttribute('aria-pressed',clone.getAttribute('aria-pressed'));
        clone.addEventListener('click',()=>{const r=state.risorse[index];if(!r)return;r.used=p<r.used?p:p+1;render();save();});
        group.append(clone);
      });
      return group;
    }
    function makeItem(card,category,index){
      const item=state[category]?.[index];if(!item)return;
      const header=document.createElement('div');header.className='power-item-header';
      const button=document.createElement('button');button.type='button';button.className='power-toggle';
      const title=card.querySelector('h3'), name=card.querySelector('[data-master-field$="|nome"]');
      const label=document.createElement('span');label.className='power-item-name';label.textContent=text(item.nome);
      const arrow=document.createElement('span');arrow.className='power-chevron';arrow.setAttribute('aria-hidden','true');arrow.textContent='⌄';
      button.append(label,arrow);header.append(button);
      if(name){header.prepend(name);label.hidden=true;button.classList.add('power-toggle-master');}
      title?.remove();
      const compact=document.createElement('div');compact.className='power-compact';
      const tag=card.querySelector('.tag');if(tag)compact.append(tag);
      const preview=document.createElement('p');preview.className='power-excerpt';
      const rich=card.querySelector('[data-rich-arr]');
      const resourceMatches=[];
      (state.risorse||[]).forEach((r,i)=>{if(key(r.nome)===key(item.nome)&&(masterOn||!r.hidden))resourceMatches.push(i);});
      const source=category==='truccetti' ? state.risorse[resourceMatches[0]]?.desc || rich?.innerHTML || item.desc : rich?.innerHTML || item.desc;
      const preset=previews[key(item.nome)];
      preview.textContent=preset&&fingerprint(item.desc)===preset[0]?preset[1]:excerpt(source);compact.append(preview);
      const full=document.createElement('div');full.className='power-full';full.id='power-full-'+category+'-'+index;
      button.setAttribute('aria-controls',full.id);
      full.append(...Array.from(card.childNodes));
      const usage=document.createElement('div');usage.className='power-full-uses';
      const existingPips=full.querySelector('.pips');
      if(existingPips)usage.append(existingPips);
      resourceMatches.forEach(i=>{const tracker=resources.get(i);if(tracker){usage.append(tracker);resources.delete(i);}});
      if(usage.childNodes.length){
        const heading=document.createElement('div');heading.className='power-uses-label';heading.textContent='Utilizzi';usage.prepend(heading);
        // The limited-use explanation belongs to the same ability, including its simultaneous mode.
        if(key(item.nome)==='superabilita'){
          const specific=text(item.desc).split(/Abilità specifica\s*:/i)[1];
          if(specific){const note=document.createElement('p');note.className='power-use-note';note.textContent=excerpt(specific);usage.insertBefore(note,heading.nextSibling);}
        }
        full.append(usage);
        const pips=compactPips(usage);if(pips.childNodes.length)compact.append(pips);
      }
      card.replaceChildren(header,compact,full);card.classList.add('power-item');card.dataset.powerItem=category+'-'+index;card.__powerItem=item;
      const setOpen=open=>{button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',(open?'Chiudi ':'Apri ')+text(item.nome));full.hidden=!open;items.set(item,open);};
      setOpen(items.get(item)||false);
      button.addEventListener('click',()=>setOpen(full.hidden));
      // Refresh excerpts after an explicit editor change without replacing the full HTML.
      rich?.addEventListener('input',()=>{preview.textContent=excerpt(rich.innerHTML);});
      name?.addEventListener('input',()=>button.setAttribute('aria-label',(full.hidden?'Apri ':'Chiudi ')+name.value));
    }
    function section(card,category,title){
      if(!card){card=document.createElement('div');card.className='card';}
      const heading=card.querySelector('h2');heading?.remove();
      card.querySelectorAll(':scope > .subcard').forEach(el=>{
        const rich=el.querySelector('[data-rich-arr]');if(!rich)return;
        const [cat,index]=rich.dataset.richArr.split('-');makeItem(el,cat,Number(index));
      });
      const details=document.createElement('details');details.className='card power-section';details.dataset.powerSection=category;
      const summary=document.createElement('summary'),name=document.createElement('span'),arrow=document.createElement('span');
      name.textContent=title;arrow.textContent='⌄';arrow.className='power-chevron';arrow.setAttribute('aria-hidden','true');summary.append(name,arrow);
      const content=document.createElement('div');content.className='power-section-content';content.append(...Array.from(card.childNodes));
      details.append(summary,content);details.open=sections.get(category)||false;
      details.addEventListener('toggle',()=>sections.set(category,details.open));
      if(card.isConnected)card.replaceWith(details);else panel.append(details);
      return content;
    }
    section(tricks,'truccetti','TRUCCHETTI');
    const abilityContent=section(abilities,'abilita','ABILITÀ');
    // Keep optional Master-created content accessible within Abilità, never discard it.
    [byTitle('Incantesimi'),byTitle('Altre Abilità Telecinetiche')].filter(Boolean).forEach(card=>abilityContent.append(card));
    if(limited){
      const leftovers=Array.from(resources.values());
      const reset=limited.querySelector('#reset-risorse'),add=limited.querySelector('[data-master-create="risorse"]');
      if(leftovers.length){const other=document.createElement('div');other.className='power-unmatched';leftovers.forEach(el=>other.append(el));abilityContent.append(other);}
      if(reset||add){const controls=document.createElement('div');controls.className='power-section-controls';if(reset)controls.append(reset);if(add)controls.append(add);abilityContent.append(controls);}
      limited.remove();
    }
    section(passives,'passive','PASSIVE');
  }
  root.MorgedalKatanPowers={capture,enhance};
})(window);
