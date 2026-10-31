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
