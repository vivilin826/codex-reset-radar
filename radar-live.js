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
    banner.textContent=(lag?'自动采集数据延迟（最近尝试 ':'自动采集正常（最近尝试 ')+time(p.last_attempt_at)+'；最近成功 '+time(p.last_success_at)+'）。待核验消息不代表已重置。';
    document.getElementById('top-updated').textContent='采集 '+time(p.last_attempt_at);
    document.getElementById('hero-time').textContent='历史判断，非实时确认';
    // Only explicit reviewed projections may replace the historical hero.
    const reviewed=data.homepage_verified;
    if(reviewed && reviewed.source_url && reviewed.reviewed_at) {
      document.getElementById('hero-title').textContent=reviewed.title;
      document.getElementById('hero-summary').textContent=reviewed.summary;
      document.getElementById('source-link').href=reviewed.source_url;
    }
    document.getElementById('judgment').textContent='历史预告，尚无新的核验确认；日期窗口可能已过期。以个人 Usage 为准。';
    const CHIP = {
      pending:   ['待兑现',   'rv-chip--pending'],
      fulfilled: ['已兑现',   'rv-chip--fulfilled'],
      observed:  ['社区实测', 'rv-chip--observed']
    };
    const predictions=panel('历史预测与兑现记录','每条 = 一次预告的窗口与结果；自动采集不会把预测改成已兑现。');
    for(const x of data.predictions||[]){
      const c = CHIP[x.status] || CHIP.pending;
      row(predictions, x.headline,
        [x.window + (x.actual_kind ? ' · ' + x.actual_kind : '') + (x.actual_at ? ' · 确认于 ' + time(x.actual_at) : ' · 尚无确认时间'), {url:x.source_url, label:'查看原帖'}],
        chip(c[0], c[1]));
    }
    collapse(predictions, 5);
    const events=panel('历史证据时间线','第三方观察与官方确认分开记录；帖子时间不代表到账时间。');
    for(const x of data.events||[]){
      row(events, x.title,
        [time(x.published_at) + (x.status_label ? ' · ' + x.status_label : ''), {url:x.source_url, label:'查看原帖'}],
        null);
    }
    collapse(events, 5);
    const queue=panel('自动采集 · 待核验消息','以下仅是采集到的候选消息，不是新的重置确认；点"查看原帖"核实。');
    const qs = data.review_queue||[];
    if(!qs.length) row(queue,'尚无候选消息','采集失败时保留旧数据，不推断没有新消息。',null);
    for(const x of qs){
      const short = (x.text||'').length > 60 ? (x.text||'').slice(0,60) + '…' : (x.text||'');
      row(queue, time(x.published_at), [short, {url:x.url, label:'查看原帖'}], chip('待核验','rv-chip--queue'));
    }
    collapse(queue, 5);
    if(lag)document.getElementById('status-label').textContent='数据延迟 · 待核验';
  } catch(e) {banner.textContent='自动采集数据暂时无法加载，保留历史页面；不能据此判断是否已重置。';document.getElementById('status-label').textContent='数据延迟 · 待核验';}
})();
