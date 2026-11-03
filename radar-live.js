/* Add live evidence to the original cream design; never infer quota fulfillment. */
(async function () {
  const main = document.querySelector('main');
  const banner = document.createElement('section'); banner.className = 'tip'; banner.setAttribute('role','status');
  document.querySelector('.hero').after(banner);
  const text = (parent, tag, value, cls) => { const e = document.createElement(tag); e.textContent = value || ''; if(cls)e.className=cls; parent.append(e); return e; };
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
    banner.textContent=(lag?'自动采集数据延迟（最近尝试 ':'自动采集正常（最近尝试 ')+time(p.last_attempt_at)+'；最近成功 '+time(p.last_success_at)+'）。具体到账以账号显示为准。';
    document.getElementById('top-updated').textContent='采集 '+time(p.last_attempt_at);
    const $=id=>document.getElementById(id);
    const posts=Object.values(data.source_posts||{}).filter(x=>
      !x.is_reply && /^https:\/\/x\.com\/thsottiaux\/status\/\d+$/.test(x.url||'') &&
      Number.isFinite(Date.parse(x.published_at)) && Date.parse(x.published_at)<=Date.now() &&
      (/^(?:Day\s*\d+\s*\/\s*)?Banked\s+\d+\/\d+[.!]?$/i.test((x.text||'').trim()) ||
      (['announcement_candidate','confirmation_candidate'].includes(x.candidate_state) && /\b(reset|banked|propagated)\b/i.test(x.text||'')))
    ).sort((a,b)=>b.published_at.localeCompare(a.published_at));
    const latest=posts[0],banked=latest && /\bbanked\b/i.test(latest.text);
    $('hero-title').textContent=latest?(banked?'已有备用重置卡后续公告':'最新重置相关公告'):'等待新的公开消息';
    $('hero-summary').textContent=latest?(latest.translation||latest.text)+'（第三方存档收录，非个人到账确认）':'不沿用过期预测。';
    $('hero-time').textContent=latest?'公告时间 '+time(latest.published_at):'暂无公告';
    $('status-label').textContent=banked?'Banked 后续公告':'公开消息已同步';
    if(latest)$('source-link').href=latest.url;
    document.querySelector('.window-label').textContent='最新公告时间 · 北京时间';
    $('win-start').textContent=latest?time(latest.published_at):'暂无';
    $('win-start').style.fontSize='22px';
    $('win-end').textContent='';
    document.querySelector('.window-arrow').hidden=true;
    $('win-label').textContent='旧观察窗口已结束；备用重置不代表当前额度自动回满。';
    $('judgment').textContent='公告时间不等于账号到账；具体资格、可用重置与余额以个人 Usage 为准。';
    $('tip-text').textContent='云端定时采集并发布，无需开电脑或手动拉取。页面每 5 分钟检查新数据；来源异常时提示延迟。';
    const seen=new Set((data.events||[]).map(x=>x.source_url));
    for(const x of posts){
      if(seen.has(x.url))continue;
      (data.events||(data.events=[])).push({id:x.id,title:x.translation||x.text,
        published_at:x.published_at,status:'observed',status_label:'公开公告（第三方存档）',
        summary:x.text+'；非个人到账确认。',source_url:x.url});
      seen.add(x.url);
    }
    const followups=posts.filter(x=>/^(?:Day\s*\d+\s*\/\s*)?Banked\s+[12]\/2[.!]?$/i.test(x.text.trim()) &&
      x.published_at>='2026-11-01T00:00:00Z' && x.published_at<'2026-11-03T00:00:00Z');
    for(const x of data.predictions||[]){
      if(x.id==='p-20261031-banked' && followups.length===2){
        x.status='observed';x.actual_kind='已收录 Banked 1/2 与 2/2 后续公告；旧窗口已结束，非个人到账确认';
        x.actual_at=followups[0].published_at;x.confirmation_url=followups[0].url;
      }
    }
    $('history').closest('.panel').querySelector('.panel-title').textContent='已收录的重置相关记录';
    $('stat-num').textContent=(data.events||[]).length;
    $('stat-label').textContent='公开记录（不等于重置次数）';
    $('stat-chip-announced').hidden=true;
    $('stat-note').textContent='包含预告与后续公告，不统计个人到账或全员完成次数。';
    const version=p.last_attempt_at;
    setInterval(async()=>{
      if(p.state!=='ok'||Date.now()-Date.parse(p.last_success_at)>2*3600000){
        banner.textContent='自动采集数据延迟；最近成功 '+time(p.last_success_at)+'。保留历史记录，不能据此判断没有新消息。';
        $('status-label').textContent='数据延迟';
      }
      if(document.visibilityState==='hidden')return;
      try{
        const r=await fetch('data/radar.json',{cache:'no-store'});
        if(r.ok && (await r.json()).pipeline?.last_attempt_at!==version)location.reload();
      }catch(_){}
    },5*60*1000);
    const labels = { pending:['待确认','rv-chip--pending'], fulfilled:['已兑现','rv-chip--fulfilled'], observed:['第三方记录','rv-chip--observed'], conditional:['活动规则','rv-chip--queue'] };
    const combined=panel('重置预告与兑现记录','按照时间查看：预告了什么、什么时候发生，以及结果是否有证据。北京时间；到账以个人账号为准。');
    const records=[], matched=new Set();
    for (const x of data.predictions||[]) {
      if(x.source_url) matched.add(x.source_url);
      if(x.confirmation_url) matched.add(x.confirmation_url);
      const c=labels[x.status]||['待确认','rv-chip--pending'];
      const parts=['预告时间：'+time(x.created_at)+'；预计：'+(x.window||'未公布')+'。', {url:x.source_url,label:'预告来源'}, '　结果：'+(x.actual_kind||'尚无确认信息')+(x.actual_at?'（'+time(x.actual_at)+'）':'。')];
      if(x.confirmation_url) parts.push({url:x.confirmation_url,label:'结果来源'});
      records.push({date:x.created_at||'',title:x.headline,parts,chip:c});
    }
    for (const x of data.events||[]) {
      if(x.source_url && matched.has(x.source_url)) continue;
      const c=x.status==='confirmed'?['历史确认','rv-chip--fulfilled']:x.status==='observed'?['第三方记录','rv-chip--observed']:['历史公告','rv-chip--pending'];
      records.push({date:x.published_at||'',title:x.title,parts:['记录时间：'+time(x.published_at)+'；'+(x.status_label||'')+'。'+(x.summary||'')+' ',{url:x.source_url,label:'查看来源'}],chip:c});
    }
    records.sort((a,b)=>b.date.localeCompare(a.date));
    for(const x of records) row(combined,x.title,x.parts,chip(x.chip[0],x.chip[1]));
    collapse(combined,5);
    document.getElementById('history').hidden=true;
    const statsDesc=document.querySelector('#history').closest('.panel').querySelector('.panel-sub');
    if(statsDesc) statsDesc.textContent='历史人工统计，非官方数字；下方可查看预告与结果。';
    if(lag)document.getElementById('status-label').textContent='数据延迟 · 待核验';
  } catch(e) {banner.textContent='自动采集数据暂时无法加载，保留历史页面；不能据此判断是否已重置。';document.getElementById('status-label').textContent='数据延迟 · 待核验';}
})();
