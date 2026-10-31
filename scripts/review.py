"""Apply hand-reviewed evidence from reviews.json: NEVER automate event fulfillment guesses."""
import json,pathlib,re,sys
root=pathlib.Path(__file__).resolve().parents[1]
p=root/'data/radar.json'; r=root/'reviews.json'
obj=json.loads(p.read_text());reviews=json.loads(r.read_text())
posts=obj.get('source_posts',{})
for approval in reviews.get('approved',[]):
    pid=approval['id']
    if pid not in posts:raise ValueError('missing source post '+pid)
    post=posts[pid]
    if approval['status'] not in ('announced','confirmed','observed'):raise ValueError('invalid status')
    if approval['type'] not in ('announcement','banked','global','partial'):raise ValueError('invalid type')
    if approval.get('source_url')!=post['url']:raise ValueError('source link mismatch')
    existing=next((x for x in obj['events'] if str(x['id'])==pid),None)
    event={'id':pid,'title':approval['title'],'type':approval['type'],
       'type_label':approval['type_label'],'status':approval['status'],
       'status_label':approval['status_label'],'published_at':post['published_at'],
       'effective_at':approval.get('effective_at'),'summary':approval['summary'],
       'source_url':post['url']}
    if existing:existing.update(event)
    else:obj['events'].insert(0,event)
# Optional manual projection—approved forecast and completion must be independently justified.
projection=reviews.get('homepage')
if projection:
    for key in ('forecast','status','last_reset','advice'):
        if key in projection:obj[key]=projection[key]
p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
print('Applied',len(reviews.get('approved',[])),'reviewed events')
