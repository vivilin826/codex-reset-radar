#!/usr/bin/env python3
"""Conservative public archive ingest. Never asserts quota changes from archive alone."""
import argparse
import datetime as dt
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data/radar.json'
API='https://www.codexreset-news.com/api/v1/tibo/history'
UTC=dt.timezone.utc

def now(): return dt.datetime.now(UTC).isoformat(timespec='seconds').replace('+00:00','Z')
def parse(s):
    if not s:return None
    try:return dt.datetime.fromisoformat(s.replace('Z','+00:00'))
    except ValueError:return None

def get_json(url):
    req=urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'CodexResetRadar/0.1 (+public-archive-reader; hourly; cached)'})
    with urllib.request.urlopen(req,timeout=22) as r:
        if r.status!=200:raise RuntimeError('source HTTP '+str(r.status))
        raw=r.read(2_500_001)
        if len(raw)>2_500_000:raise RuntimeError('source payload too large')
        return json.loads(raw)

def collect(limit=100):
    items=[]
    for offset in (0,100):
        # Do not poll every page every hour. Latest 200 records covers missed windows.
        obj=get_json(API+'?'+urllib.parse.urlencode({'limit':min(limit,100),'offset':offset}))
        if not isinstance(obj,dict) or not isinstance(obj.get('items'),list):raise RuntimeError('upstream schema changed')
        items+=obj['items']
        if len(obj['items'])<limit:break
    return items

RESET=re.compile(r'\b(resets?|banked|propagat(?:ed|ing)|usage limits?)\b',re.I)
BANKED=re.compile(r'\bbanked\b',re.I)
DONE=re.compile(r'\b(all (?:reset|done|fixed)|resets? (?:all )?(?:propagated|completed|done)|(?:it.s|it is|and it.s|and it is) done|done and dusted|fully propagated|is all propagated)\b',re.I)
FUTURE=re.compile(r'\b(will|we.ll|coming|tomorrow|next|by midnight|landing|loading|soon|today is a reset|reset by|promised)\b',re.I)

def classify(post):
    text=post.get('text','')
    kind='banked' if BANKED.search(text) else 'global'
    if DONE.search(text): status='confirmation_candidate'
    elif RESET.search(text) and FUTURE.search(text):status='announcement_candidate'
    elif RESET.search(text):status='context_candidate'
    else: status='other'
    return kind,status

def sane(post):
    pid=str(post.get('id',''))
    url=post.get('url','')
    stamp=post.get('published_at')
    if not re.fullmatch(r'\d{12,22}',pid):return False
    if url!=f'https://x.com/thsottiaux/status/{pid}':return False
    if not parse(stamp):return False
    if not isinstance(post.get('text'),str) or not post['text'].strip():return False
    return True

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--fixture');args=ap.parse_args()
    data=json.loads(DATA.read_text())
    p=data.setdefault('pipeline',{})
    p['last_attempt_at']=now();p['provider']='codexreset-news.com public API (third-party archive)'
    try:
        incoming=json.loads(pathlib.Path(args.fixture).read_text()) if args.fixture else collect()
        if isinstance(incoming,dict):incoming=incoming['items']
        valid=[x for x in incoming if isinstance(x,dict) and sane(x)]
        if not valid:raise RuntimeError('No valid attributable Tibo records')
        history=data.setdefault('source_posts',{})
        changed=0
        for x in valid:
            kind,status=classify(x)
            pid=str(x['id'])
            record={'id':pid,'published_at':x['published_at'],'text':x['text'],
                'url':x['url'],'kind_hint':kind,'candidate_state':status,
                'is_reply':bool(x.get('is_reply')),
                'original_verification':x.get('post_verification','not_verified'),
                'upstream_source':x.get('source',''),
                'upstream_channel':x.get('source_channel',''),
                'quota_verified':False,
                'translation':(x.get('translations') or {}).get('zh-CN','')}
            if history.get(pid)!=record:history[pid]=record;changed+=1
        p.update({'state':'ok','last_success_at':now(),'message':'候选原帖已更新；完成/范围仍需人工审核','latest_count':len(valid),'new_or_changed':changed})
        # Machine never upgrades observed/confirmed status or promises from words alone.
        # New source posts are visible in a separate queue, so no old event is erased or overwritten.
        candidates=[x for x in history.values() if x['candidate_state']!='other']
        candidates.sort(key=lambda x:x['published_at'],reverse=True)
        data['review_queue']=candidates[:50]
        data['mode']='live' # data mode means collection active, NOT verified quota.
        DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        print('OK: valid',len(valid),'changed',changed,'review queue',len(data['review_queue']))
    except Exception as e:
        p['state']='error';p['message']=f'采集不可用（{type(e).__name__}）；保留上次成功记录，禁止推断无新消息'
        # Preserve most recent reliable data, avoid overwriting verified_at.
        DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        print('WARNING: upstream unavailable: '+str(e)[:250],file=sys.stderr)
        # Exit 0 so site still publishes the explicit failure banner; Action also alerts in logs.
        return 0
    return 0

if __name__=='__main__':sys.exit(main())
