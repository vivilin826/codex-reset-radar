/* Add live evidence to the original cream design; never infer quota fulfillment. */
(async function () {
  const main = document.querySelector('main');
  const banner = document.createElement('section'); banner.className = 'tip'; banner.setAttribute('role','status');
  document.querySelector('.hero').after(banner);
  const text = (parent, tag, value, cls) => { const e = document.createElement(tag); e.textContent = value || ''; if(cls)e.className=cls; parent.append(e); return e; };
  const plain = value => String(value||'')
    .replace(/(?:Day\s*(\d+)\s*\/\s*)?Banked\s*(\d+)\s*\/\s*(\d+)/gi,(_,day,n,total)=>'第 '+n+' 次备用重置已公布（共 '+total+' 次）')
    .replace(/Day\s*(\d+)\s*[:：/]/gi,'第 $1 天：')
    .replace(/Full\s*\/\s*Global|Full Reset|Global Reset/gi,'直接重置额度')
    .replace(/Banked Reset|banked resets?|Banked|储备重置/gi,'备用重置')
    .replace(/\bReset\b/gi,'重置')
    .replace(/\bUsage\b/g,'用量页面');
  const shortTime = value => value ? new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}) : '暂无';
  const time = value => value ? new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) : '尚无成功记录';
  /* 自包含样式：状态标签 + 折叠按钮（不依赖页面 CSS） */
  const style = document.createElement('style');
  style.textContent =
    '.rv-row{display:block;}' +
    '.rv-more{display:flex;align-items:center;gap:5px;margin:2px auto 14px;padding:7px 16px;font-size:13px;font-weight:700;color:#D99A2B;background:#FFF7E4;border:1px solid #F0E3CE;border-radius:999px;cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
    '.rv-chip{display:inline-block;font-size:11px;font-weight:700;line-height:1;padding:4px 8px;border-radius:999px;margin-right:7px;vertical-align:1.5px;}' +
    '.rv-chip--pending{background:#FCE8C2;color:#D99A2B;}' +
    '.rv-chip--fulfilled{background:#D9F0E6;color:#2E9E72;}' +
    '.rv-chip--observed{background:#FFE4D6;color:#F2734F;}' +
    '.rv-chip--queue{background:#F3ECE0;color:#8A7361;}' +
    '.rv-link{font-size:12px;color:#D99A2B;text-decoration:none;white-space:nowrap;margin-left:4px;}';
  document.head.append(style);
  const chip = (label, cls) => { const s = document.createElement('span'); s.className = 'rv-chip ' + cls; s.textContent = label; return s; };
  const row = (box, title, descParts, chipEl) => {
    const d = text(box,'div','','rule rv-row');
    
    const t = text(d,'div','','rule-title');
    if(chipEl) t.append(chipEl);
    t.append(document.createTextNode(title));
    const p = text(d,'p','','rule-desc');
    (descParts||[]).forEach(part => {
      if(part && part.url){ const a = document.createElement('a'); a.className='rv-link'; a.href=part.url; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent = part.label || '查看原帖'; p.append(a); }
      else if(part){ p.append(document.createTextNode(part)); }
    });
    return d;
  };
  const collapse = (box, limit) => {
    const rows = box.querySelectorAll('.rv-row');
    if(rows.length <= limit) return;
    style.textContent += '.rv-collapsed .rv-row:nth-child(n+' + (limit + 1) + '){display:none !important;}';
    box.classList.add('rv-collapsed');
    const btn = text(box,'button','展开全部（' + rows.length + ' 条）','rv-more');
    btn.addEventListener('click', () => {
      const open = box.classList.toggle('rv-open');
      box.classList.toggle('rv-collapsed', !open);
      btn.textContent = open ? '收起' : '展开全部（' + rows.length + ' 条）';
    });
  };
  const panel = (title, sub) => {const s=text(main,'section','','panel'); main.insertBefore(s, main.querySelector('.follow')); text(s,'h2',title,'panel-title cute');text(s,'p',sub,'panel-sub');return text(s,'div','','rules');};
  try {
    const response=await fetch('data/radar.json',{cache:'no-store'}); if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json(), p=data.pipeline||{};
    const lag=p.state!=='ok'||!p.last_success_at||Date.now()-Date.parse(p.last_success_at)>2*3600000;
    banner.style.display=lag?'block':'none';
    banner.textContent='消息更新暂时延迟，以下保留最近记录。最近更新：'+shortTime(p.last_success_at);
    document.getElementById('top-updated').textContent='更新于 '+shortTime(p.last_success_at);
    const $=id=>document.getElementById(id);
    const posts=Object.values(data.source_posts||{}).filter(x=>
      !x.is_reply && /^https:\/\/x\.com\/thsottiaux\/status\/\d+$/.test(x.url||'') &&
      Number.isFinite(Date.parse(x.published_at)) && Date.parse(x.published_at)<=Date.now() &&
      (/^(?:Day\s*\d+\s*\/\s*)?Banked\s+\d+\/\d+[.!]?$/i.test((x.text||'').trim()) ||
      (['announcement_candidate','confirmation_candidate'].includes(x.candidate_state) && /\b(reset|banked|propagated)\b/i.test(x.text||'')))
    ).sort((a,b)=>b.published_at.localeCompare(a.published_at));
    // The wording and Beijing-time window were reviewed against this specific reply.
    const hint = data.source_posts?.['2120410480204525936'];
    const windowEnd = Date.parse('2026-11-13T16:00:00+08:00');
    const confirmedBankedIds = new Set(['2116692529970311254', '2117035794678546764']);
    const latestConfirmedAt = Math.max(
      ...posts.filter(post => confirmedBankedIds.has(post.id)).map(post => Date.parse(post.published_at)),
      ...(data.events || []).filter(event => event.status === 'confirmed').map(event => Date.parse(event.published_at)).filter(Number.isFinite)
    );
    const matchingConfirmation = hint && (data.events || []).some(event =>
      event.status === 'confirmed' && event.type === 'banked' &&
      Date.parse(event.published_at) >= Date.parse(hint.published_at));
    const hasHint = hint && !matchingConfirmation;
    const activeHint = hasHint && Date.now() < windowEnd;
    const latestAnnouncement = posts.find(post =>
      post.candidate_state === 'announcement_candidate' && Date.parse(post.published_at) > latestConfirmedAt);
    const currentSource = activeHint ? hint : latestAnnouncement;
    const window = document.querySelector('.window');
    window.hidden = !activeHint;
    $('hero-time').hidden = true;
    $('status-label').textContent = currentSource ? '预测 · 等待确认' : '预测';
    $('hero-title').textContent = activeHint ? '周四可能发放备用重置' :
      latestAnnouncement ? '有新的重置预告' : '暂时没有新的重置预测';
    $('hero-summary').textContent = activeHint ?
      'Tibo 说周四可能会发一张备用重置卡。具体时间和适用套餐还没公布。' :
      latestAnnouncement ? plain(latestAnnouncement.translation || latestAnnouncement.text) :
      '已确认的消息可以在下方查看。';
    $('source-link').hidden = !currentSource;
    if (currentSource) $('source-link').href = currentSource.url;
    document.querySelector('.window-label').textContent = '预计观察时间 · 北京时间';
    $('win-start').textContent = '11/12 16:00';
    $('win-end').textContent = '11/13 16:00';
    $('win-label').textContent = '按美西周四换算，具体发放时间尚未公布。';
    $('judgment').textContent = activeHint ? '这次仍在等待发放确认。' : '';
    $('judgment').closest('.judgment').hidden = !activeHint;
    $('tip-text').textContent = '收到备用重置后，可以留到需要时再用。在 Codex 的「设置 → 用量」查看。';
    if (activeHint) {
      // Re-evaluate the forecast even if the browser stays open past the window.
      setTimeout(() => location.reload(), windowEnd - Date.now() + 500);
    }
    const seen=new Set((data.events||[]).map(x=>x.source_url));
    for(const x of posts){
      if(seen.has(x.url))continue;
      (data.events||(data.events=[])).push({id:x.id,title:plain(x.text),
        published_at:x.published_at,status:'observed',status_label:'已公布',
        summary:/banked/i.test(x.text)?'备用重置可以留待需要时使用，是否收到请查看自己的账号。':plain(x.translation||x.text),source_url:x.url});
      seen.add(x.url);
    }
    const followups=posts.filter(x=>/^(?:Day\s*\d+\s*\/\s*)?Banked\s+[12]\/2[.!]?$/i.test(x.text.trim()) &&
      x.published_at>='2026-11-01T00:00:00Z' && x.published_at<'2026-11-03T00:00:00Z');
    for(const x of data.predictions||[]){
      if(x.id==='p-20261031-banked' && followups.length===2){
        x.status='observed';x.actual_kind='两次备用重置均有后续消息，请到自己的账号查看是否收到';
        x.actual_at=followups[0].published_at;x.confirmation_url=followups[0].url;
      }
    }
    $('history').closest('.panel').hidden=true;
    $('stat-num').textContent=(data.events||[]).length;
    $('stat-label').textContent='公开记录（不等于重置次数）';
    $('stat-chip-announced').hidden=true;
    $('stat-note').textContent='包含预告与后续公告，不统计个人到账或全员完成次数。';
    const version=p.last_attempt_at;
    setInterval(async()=>{
      if(p.state!=='ok'||Date.now()-Date.parse(p.last_success_at)>2*3600000){
        banner.style.display='block'; banner.textContent='消息更新暂时延迟，以下保留最近记录。最近更新：'+shortTime(p.last_success_at);
        $('status-label').textContent='数据延迟';
      }
      if(document.visibilityState==='hidden')return;
      try{
        const r=await fetch('data/radar.json',{cache:'no-store'});
        if(r.ok && (await r.json()).pipeline?.last_attempt_at!==version)location.reload();
      }catch(_){}
    },5*60*1000);
    const labels = { pending:['待确认','rv-chip--pending'], fulfilled:['已兑现','rv-chip--fulfilled'], observed:['已有后续','rv-chip--observed'], conditional:['活动规则','rv-chip--queue'] };
    const confirmedRecords=panel('已确认的重置','这里记录公开确认的重置消息。个人是否收到，请查看账号用量。');
    const combined=panel('其他重置消息','这里可以查看往期预告和相关消息。');
    const records=[], matched=new Set();
    for (const x of data.predictions||[]) {
      if(x.source_url) matched.add(x.source_url);
      if(x.confirmation_url && x.status!=='fulfilled') matched.add(x.confirmation_url);
      const c=labels[x.status]||['待确认','rv-chip--pending'];
      const parts=['预告时间：'+time(x.created_at)+'；预计：'+(x.window||'未公布')+'。', {url:x.source_url,label:'预告来源'}, '　结果：'+(x.actual_kind||'尚无确认信息')+(x.actual_at?'（'+time(x.actual_at)+'）':'。')];
      if(x.confirmation_url) parts.push({url:x.confirmation_url,label:'结果来源'});
      if (x.status !== 'fulfilled' || !(data.events || []).some(event =>
        event.status === 'confirmed' && event.source_url === x.confirmation_url)) {
        const confirmed = x.status === 'fulfilled';
        records.push({date:(confirmed ? x.actual_at : x.created_at)||'',title:plain(x.headline),parts,chip:c,confirmed});
      }
    }
    for (const x of data.events||[]) {
      if(x.source_url && matched.has(x.source_url) && !confirmedBankedIds.has(String(x.id))) continue;
      const bankedConfirmed = confirmedBankedIds.has(String(x.id));
      const confirmed = bankedConfirmed || x.status === 'confirmed';
      const c = confirmed ? ['已确认','rv-chip--fulfilled'] : x.status === 'observed' ?
        ['已公布','rv-chip--observed'] : ['历史公告','rv-chip--pending'];
      const summary = bankedConfirmed ? 'Tibo 已公布本次备用重置。个人是否收到请查看账号用量。' : x.summary || '';
      records.push({date:x.published_at||'',title:plain(x.title),
        parts:[shortTime(x.published_at)+'（北京时间）。'+summary+' ',{url:x.source_url,label:'查看原帖'}],
        chip:c,confirmed});
    }
    if (hasHint && !activeHint) {
      records.push({date:hint.published_at,title:'周四可能发放备用重置',parts:[
        '预计观察时间已结束，暂无发放确认。',{url:hint.url,label:'查看原帖'}],
        chip:['等待确认','rv-chip--pending']});
    }
    records.sort((a,b)=>b.date.localeCompare(a.date));
    for(const x of records) {
      row(x.confirmed ? confirmedRecords : combined,plain(x.title),
        x.parts.map(part=>typeof part==='string'?plain(part):part),chip(x.chip[0],x.chip[1]));
    }
    collapse(confirmedRecords,5);
    collapse(combined,5);
    document.getElementById('history').hidden=true;
    const statsDesc=document.querySelector('#history').closest('.panel').querySelector('.panel-sub');
    if(statsDesc) statsDesc.textContent='历史人工统计，非官方数字；下方可查看预告与结果。';
    if(lag)document.getElementById('status-label').textContent='更新暂时延迟';
  } catch(e) {banner.style.display='block'; banner.textContent='最新消息暂时加载失败，请稍后刷新。';document.getElementById('status-label').textContent='更新暂时延迟';}
})();
