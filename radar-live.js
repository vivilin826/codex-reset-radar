/* Add live evidence to the original cream design; never infer quota fulfillment. */
(async function () {
  const main = document.querySelector('main');
  const banner = document.createElement('section'); banner.className = 'tip'; banner.setAttribute('role','status');
  document.querySelector('.hero').after(banner);
  const text = (parent, tag, value, cls) => { const e = document.createElement(tag); e.textContent = value || ''; if(cls)e.className=cls; parent.append(e); return e; };
  const link = (parent, label, url) => { try { const u=new URL(url); if(u.protocol!=='https:')return; const a=text(parent,'a',label,'source-link'); a.href=u.href; a.target='_blank'; a.rel='noopener noreferrer'; }catch(_){} };
  const time = value => value ? new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) : '尚无成功记录';
  const panel = (title, sub) => {const s=text(main,'section','','panel');text(s,'h2',title,'panel-title cute');text(s,'p',sub,'panel-sub');return text(s,'div','','rules');};
  const row = (box,title,body,url) => {const d=text(box,'div','','rule');d.style.display='block';text(d,'div',title,'rule-title');text(d,'p',body,'rule-desc');if(url)link(d,'查看来源',url);return d;};
  try {
    const response=await fetch('data/radar.json',{cache:'no-store'}); if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json(), p=data.pipeline||{};
    const lag=p.state!=='ok'||!p.last_success_at||Date.now()-Date.parse(p.last_success_at)>2*3600000;
    banner.textContent=(lag?'数据延迟：':'自动采集正常：')+'最近尝试 '+time(p.last_attempt_at)+'；最近成功 '+time(p.last_success_at)+'。'+(p.message||'')+'。保留历史记录；待核验消息不代表已重置。';
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
    const predictions=panel('历史预测与兑现记录','保留工程 ZIP 原始记录；历史资料未在本次重新核验。自动采集不会将预测改为已兑现。');
    for(const x of data.predictions||[])row(predictions,x.headline,`${x.window} · ${x.status} · ${x.actual_kind||''} · ${x.actual_at?time(x.actual_at):'无确认时间'}`,x.source_url);
    const events=panel('历史证据时间线','保留原始状态与来源；第三方观察和官方确认分开记录。');
    for(const x of data.events||[])row(events,x.title,`${x.status_label} · ${time(x.published_at)} · ${x.summary}`,x.source_url);
    const queue=panel('自动采集 · 待核验消息','以下仅为第三方归档候选，不是新的重置确认；帖子时间不等于到账时间。');
    if(!(data.review_queue||[]).length)row(queue,'尚无候选消息','采集失败时保留旧数据，不推断没有新消息。');
    for(const x of data.review_queue||[])row(queue,time(x.published_at)+' · 待核验',x.text,x.url);
    if(lag)document.getElementById('status-label').textContent='数据延迟 · 待核验';
  } catch(e) {banner.textContent='数据延迟：暂时无法加载自动采集数据，保留历史页面；不能据此判断是否已重置。';document.getElementById('status-label').textContent='数据延迟 · 待核验';}
})();
