import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from update import classify,sane
class PipelineTests(unittest.TestCase):
    def test_future_banked(self):
        self.assertEqual(classify({'text':'Next two days will be resets… banked…'}),('banked','announcement_candidate'))
    def test_confirmed(self):
        self.assertEqual(classify({'text':'Reset all propagated. Enjoy!'}),('global','confirmation_candidate'))
    def test_no_reddit_only(self):
        self.assertEqual(classify({'text':'@someone can I have a reset?'}),('global','context_candidate'))
    def test_id_and_url(self):
        self.assertTrue(sane({'id':'2116405414921384099','url':'https://x.com/thsottiaux/status/2116405414921384099','published_at':'2026-10-31T05:42:26Z','text':'Next two days will be resets… banked…'}))
    def test_fake_url(self):
        self.assertFalse(sane({'id':'2116405414921384099','url':'https://example.com/claim','published_at':'2026-10-31T05:42:26Z','text':'done'}))
if __name__=='__main__':unittest.main()

class AutoReviewTests(unittest.TestCase):
    def seed(self):
        return {
            'events': [{'id': 'M1', 'title': '人工保留事件', 'status': 'fulfilled',
                        'status_label': '已兑现', 'published_at': '2026-10-27T00:00:00Z',
                        'source_url': 'https://x.com/thsottiaux/status/M1', 'auto': False}],
            'predictions': [{'id': 'p1', 'status': 'pending'}],
            'forecast': {}, 'status': {}, 'last_reset': {}, 'advice': {},
            'source_posts': {
                'A': {'id': 'A', 'published_at': '2026-10-28T14:30:00Z',
                      'text': 'It is all propagated. Enjoy some mad codexing',
                      'url': 'https://x.com/thsottiaux/status/A', 'kind_hint': 'global',
                      'candidate_state': 'confirmation_candidate', 'quota_verified': False,
                      'upstream_channel': 'x'},
                'B': {'id': 'B', 'published_at': '2026-10-28T15:00:00Z',
                      'text': 'Confirmed landed across all accounts. Reset completed.',
                      'url': 'https://codex-reset.com/roundup/b', 'kind_hint': 'global',
                      'candidate_state': 'context_candidate', 'quota_verified': False,
                      'upstream_channel': 'timeline'},
                'C': {'id': 'C', 'published_at': '2026-10-28T16:00:00Z',
                      'text': 'Done and dusted',
                      'url': 'https://x.com/thsottiaux/status/C', 'kind_hint': 'banked',
                      'candidate_state': 'confirmation_candidate', 'quota_verified': False,
                      'upstream_channel': 'x'},
            },
            'review_queue': [
                {'id': 'A', 'quota_verified': False},
                {'id': 'C', 'quota_verified': False},
            ],
            'pipeline': {'state': 'ok'},
        }

    def run_auto(self, seed):
        import tempfile, json, auto_review
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'radar.json'
            path.write_text(json.dumps(seed))
            with patch.object(auto_review, 'DATA', path):
                auto_review.main()
            return json.loads(path.read_text())

    def test_dual_source_confirmed(self):
        actual = self.run_auto(self.seed())
        events = {e['id']: e for e in actual['events']}
        self.assertIn('A', events)
        self.assertEqual(events['A']['status'], 'confirmed')
        self.assertTrue(events['A']['auto'])
        self.assertEqual(events['A']['corroboration_url'],
                         'https://codex-reset.com/roundup/b')
        self.assertTrue(actual['source_posts']['A']['quota_verified'])

    def test_tibo_only_not_confirmed(self):
        actual = self.run_auto(self.seed())
        events = {e['id']: e for e in actual['events']}
        self.assertNotIn('C', events)
        self.assertFalse(actual['source_posts']['C']['quota_verified'])

    def test_manual_event_preserved(self):
        actual = self.run_auto(self.seed())
        manual = [e for e in actual['events'] if e['id'] == 'M1']
        self.assertEqual(len(manual), 1)
        self.assertEqual(manual[0]['status'], 'fulfilled')
        self.assertFalse(manual[0].get('auto'))

    def test_queue_excludes_confirmed(self):
        actual = self.run_auto(self.seed())
        self.assertNotIn('A', [q['id'] for q in actual['review_queue']])
        self.assertIn('C', [q['id'] for q in actual['review_queue']])

    def test_projection_and_stats(self):
        actual = self.run_auto(self.seed())
        self.assertEqual(actual['status']['key'], 'reset')
        self.assertEqual(actual['stats']['doneCount'], 2)
        self.assertEqual(actual['stats']['announcedCount'], 1)

class RetentionTests(unittest.TestCase):
    def run_update(self, failure=False):
        import tempfile,json,update
        from unittest.mock import patch
        seed={'events':[{'id':'old'}],'predictions':[{'id':'p','status':'pending'}],'forecast':{'window':'old'},'status':{'title':'old'},'verified_at':'2026-10-01T00:00:00Z','source_posts':{'old':{'id':'old','candidate_state':'other'}}}
        with tempfile.TemporaryDirectory() as directory:
            path=pathlib.Path(directory)/'radar.json';path.write_text(json.dumps(seed))
            post={'id':'2116405414921384099','url':'https://x.com/thsottiaux/status/2116405414921384099','published_at':'2026-10-31T05:42:26Z','text':'Reset all propagated. Enjoy!'}
            with patch.object(update,'DATA',path),patch.object(sys,'argv',['update.py']),patch.object(update,'collect',side_effect=RuntimeError('offline')) if failure else patch.object(update,'collect',return_value=[post]):
                update.main()
            actual=json.loads(path.read_text())
        for key in ('events','predictions','forecast','status','verified_at'):
            self.assertEqual(actual[key],seed[key])
        return actual
    def test_failure_retains_history(self):
        actual=self.run_update(True);self.assertEqual(actual['pipeline']['state'],'error');self.assertIn('old',actual['source_posts'])
    def test_candidate_never_confirms_reset(self):
        actual=self.run_update();self.assertEqual(actual['pipeline']['state'],'ok');self.assertFalse(actual['review_queue'][0]['quota_verified'])
