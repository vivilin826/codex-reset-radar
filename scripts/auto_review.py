#!/usr/bin/env python3
"""Conservative dual-source auto-review.

A reset is promoted to "confirmed" only when BOTH sources agree:
  1. Tibo direct post (channel `x`, confirmation wording: done / propagated / landed);
  2. a third-party timeline record within 24h stating landed / confirmed / propagated.

Manual curated events (events without `auto: true`) are never touched. Homepage
projection is regenerated from the strongest available evidence; reviews.json
still runs after this step and may override manual projections. On any failure
the previous evidence is retained; this script never infers a reset from words alone.
"""
import datetime as dt
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'radar.json'
UTC = dt.timezone.utc
CN = dt.timezone(dt.timedelta(hours=8))

DONE = re.compile(
    r'\b(all (?:reset|done|fixed)|resets? (?:all )?(?:propagated|completed|done)'
    r'|(?:it.s|it is|and it.s|and it is) done|done and dusted|fully propagated'
    r'|is all propagated|has landed|it.s done)\b', re.I)
LANDED = re.compile(
    r'\b(landed|confirmed landed|propagat(?:ed|ing)|applied across all'
    r'|seen in (?:accounts|users)|reset (?:has )?completed)\b', re.I)
RESET = re.compile(r'\breset|usage limit|banked|propagat', re.I)

PAIR_WINDOW_HOURS = 24
CONFIRMED_STATUSES = {'confirmed', 'fulfilled', 'observed'}


def parse(s):
    if not s:
        return None
    try:
        return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except ValueError:
        return None


def cn_display(iso):
    t = parse(iso)
    if not t:
        return '—'
    return t.astimezone(CN).strftime('%m 月 %d 日 %H:%M')


def tibo_done(post):
    """Signal A: Tibo's own completion post."""
    if post.get('upstream_channel') != 'x':
        return False
    if post.get('candidate_state') != 'confirmation_candidate':
        return False
    return bool(DONE.search(post.get('text', '')))


def tp_landed(post):
    """Signal B: third-party timeline record stating the reset landed."""
    if post.get('upstream_channel') != 'timeline':
        return False
    if not LANDED.search(post.get('text', '')):
        return False
    return bool(RESET.search(post.get('text', '')))


def match_tp(tibo, third_party, used):
    """Pick the nearest unused third-party record within the window (one-to-one)."""
    tt = parse(tibo.get('published_at'))
    if not tt:
        return None
    best, best_dt = None, None
    for tp in third_party:
        if tp['id'] in used:
            continue
        pt = parse(tp.get('published_at'))
        if not pt:
            continue
        delta = abs((pt - tt).total_seconds())
        if delta <= PAIR_WINDOW_HOURS * 3600 and (best_dt is None or delta < best_dt):
            best, best_dt = tp, delta
    return best


def build_event(tibo, tp):
    kind = tibo.get('kind_hint') or 'global'
    type_label = 'Banked 重置' if kind == 'banked' else 'Full Reset'
    return {
        'id': tibo['id'],
        'title': f'{type_label}落地 · 双来源确认',
        'type': kind,
        'type_label': type_label,
        'status': 'confirmed',
        'status_label': '自动确认 · 双来源',
        'published_at': tibo['published_at'],
        'effective_at': tp['published_at'],
        'summary': 'Tibo 本人完成帖与第三方归档落地记录在 24 小时内相互印证；公开落地不等于个人到账时刻，以个人 Usage 为准。',
        'source_url': tibo['url'],
        'corroboration_url': tp['url'],
        'auto': True,
    }


def project(data, events):
    """Regenerate top-level homepage projection from evidence."""
    ordered = sorted(events, key=lambda e: e.get('published_at') or '', reverse=True)
    latest = ordered[0] if ordered else None
    confirmed_events = [e for e in ordered if e.get('status') in CONFIRMED_STATUSES]
    pending_predictions = [p for p in data.get('predictions', []) if p.get('status') == 'pending']

    if latest and latest.get('status') in CONFIRMED_STATUSES and latest.get('type') == 'banked':
        data['status'] = {'emoji': '🎟️', 'key': 'reset', 'title': latest['title'], 'description': latest['summary']}
        data['last_reset'] = {
            'display': cn_display(latest.get('published_at')),
            'description': latest.get('status_label') or '重置卡确认上线',
            'type': latest.get('type_label') or 'Banked 重置卡',
            'explanation': latest['summary'],
        }
        data['forecast'] = {}
        data['advice'] = {'title': '查看你的重置卡', 'text': '打开 Codex Usage 查看可用重置卡，可留到需要时再使用。'}
    elif latest and latest.get('status') in CONFIRMED_STATUSES:
        data['status'] = {
            'emoji': '✅', 'key': 'reset',
            'title': '已确认发放重置',
            'description': '双来源自动确认；公开落地时间不等于个人到账时刻。',
        }
        data['last_reset'] = {
            'display': cn_display(latest.get('published_at')),
            'description': latest.get('status_label') or '完成确认 · 北京时间',
            'type': latest.get('type_label') or 'Reset',
            'explanation': '自动确认基于本人帖 + 第三方归档双来源；资格与生效范围以个人 Usage 为准。',
        }
        data['forecast'] = {}
        data['advice'] = {
            'title': '额度已补齐',
            'text': '优先跑之前被卡住的活；是否到账仍以个人 Usage 实际显示为准。',
        }
    elif latest and latest.get('status') in ('announced',):
        old_fc = data.get('forecast') or {}
        data['status'] = {
            'emoji': '🎟️', 'key': 'announced',
            'title': latest.get('title') or 'Tibo 预告发放重置',
            'description': '预告尚未双来源落地确认，窗口可能变化。',
        }
        data['forecast'] = {
            'label': old_fc.get('label') or latest.get('type_label') or '预告',
            'confidence': '预告可信度：待双来源确认',
            'window': old_fc.get('window') or '等待落地记录',
            'reason': old_fc.get('reason') or '该预告来自采集候选，完成帖与第三方落地记录尚未相互印证。',
        }
        data['advice'] = {
            'title': '大任务先留着',
            'text': '看到落地确认后再放开跑被卡住的活，避免刚用完额度就重置。',
        }
    else:
        data['status'] = {
            'emoji': '🌤️', 'key': 'silent',
            'title': '暂无明确预告',
            'description': '近期待核验消息未构成双来源确认，按正常节奏使用。',
        }
        data['forecast'] = {}
        data['advice'] = {
            'title': '暂无重置信号',
            'text': '按正常节奏使用；出现预告或落地记录后本页会自动更新。',
        }

    existing_stats = data.get('stats') or {}
    computed_done = len(confirmed_events)
    baseline_done = existing_stats.get('doneCount')
    done_count = baseline_done if isinstance(baseline_done, int) and baseline_done >= computed_done else computed_done
    data['stats'] = {
        'doneCount': done_count,
        'announcedCount': len(pending_predictions),
        'trackingStart': existing_stats.get('trackingStart', '2026-09-26'),
        'note': '次数含人工跟踪历史记录，自动统计已确认/实测事件；非官方口径，以个人 Usage 为准。',
    }


def main():
    try:
        data = json.loads(DATA.read_text())
    except Exception as e:
        print(f'WARNING: radar.json unreadable: {e}', file=sys.stderr)
        return 0

    try:
        posts = list(data.get('source_posts', {}).values())
        third_party = [p for p in posts if tp_landed(p)]
        used_tp = set()

        events = data.setdefault('events', [])
        manual = [e for e in events if not e.get('auto')]
        auto_events = [e for e in events if e.get('auto')]
        auto_by_id = {e['id']: e for e in auto_events}

        confirmed = 0
        for tibo in sorted(posts, key=lambda p: p.get('published_at') or ''):
            if not tibo_done(tibo):
                continue
            tp = match_tp(tibo, third_party, used_tp)
            if not tp:
                continue
            used_tp.add(tp['id'])
            tibo['quota_verified'] = True
            tibo['candidate_state'] = 'confirmed_auto'
            event = build_event(tibo, tp)
            existing = auto_by_id.get(event['id'])
            if existing:
                existing.update(event)
            else:
                auto_by_id[event['id']] = event
            confirmed += 1

        # Manual curated events win; auto events are refreshed above.
        data['events'] = manual + sorted(auto_by_id.values(),
                                         key=lambda e: e.get('published_at') or '', reverse=True)

        # Already-confirmed posts leave the pending queue (state synced from source_posts).
        source_posts = data.get('source_posts', {})
        data['review_queue'] = [
            q for q in data.get('review_queue', [])
            if not source_posts.get(q.get('id'), {}).get('quota_verified')
        ]

        project(data, data['events'])
        data.setdefault('pipeline', {})['auto_review'] = {
            'confirmed_auto': confirmed,
            'rule': 'tibo_done + third_party_landed within 24h',
        }
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        print(f'OK: auto-confirmed {confirmed} dual-source events; events total {len(data["events"])}')
    except Exception as e:
        data.setdefault('pipeline', {})['message'] = f'自动复核不可用（{type(e).__name__}）；保留上次记录，禁止推断重置。'
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        print(f'WARNING: auto-review failed: {str(e)[:200]}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
