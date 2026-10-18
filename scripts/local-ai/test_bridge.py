import json, threading, unittest
import subprocess
from types import SimpleNamespace
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
import bridge as B

class BridgeTests(unittest.TestCase):
    @patch.object(B,'reserve')
    @patch.object(B,'upstream')
    @patch.object(B.subprocess,'run')
    def test_explicit_cpu_fallback_leaves_ollama_alone(self,run,upstream,reserve):
        run.return_value=SimpleNamespace(returncode=0,stdout=json.dumps({'rows':[{'raw':'Other','eos':True}],'device':'cpu'}))
        self.assertEqual(B.classify(['public sample'],'cpu')['rows'][0]['label'],'Other')
        self.assertEqual(json.loads(run.call_args.kwargs['input'])['device'],'cpu')
        upstream.assert_not_called()
    @patch.object(B,'reserve')
    @patch.object(B,'upstream',return_value={'models':[]})
    @patch.object(B.subprocess,'run',side_effect=subprocess.TimeoutExpired('worker',240))
    def test_worker_timeout_does_not_publish_output(self,run,upstream,reserve):
        with self.assertRaises(subprocess.TimeoutExpired): B.classify(['sample'])
    def test_strict_financial_json(self):
        for text in ['{"approved":false,"approved":true}','{"value":NaN}','{"value":Infinity}']:
            with self.assertRaises(ValueError): B.strict_json(text)
    @patch.object(B,'reserve')
    @patch.object(B,'upstream')
    def test_editor_json_is_validated_before_any_calculation(self,upstream,reserve):
        with self.assertRaises(ValueError):B.dispatch('/api/local-ai/calculate',{'approved':True,'tool':'income-noi','inputs_json':'{"rent":1,"rent":2}'})
        upstream.assert_not_called()
    def test_session_and_busy_http(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),B.Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        def request(path,body=b'{}',cookie=None):
            headers={'Host':'127.0.0.1:8766','Origin':B.ORIGIN,'Content-Type':'application/json'}
            if cookie:headers['Cookie']=cookie
            return urlopen(Request(f'http://127.0.0.1:{server.server_port}/api/local-ai/'+path,data=body,headers=headers),timeout=5)
        try:
            with self.assertRaises(HTTPError) as error:request('chat')
            self.assertEqual(error.exception.code,401)
            with request('session') as response:
                self.assertIn('HttpOnly',response.headers['Set-Cookie']);cookie=response.headers['Set-Cookie'].split(';')[0]
            B.LOCK.acquire()
            try:
                with self.assertRaises(HTTPError) as error:request('chat',cookie=cookie)
                self.assertEqual(error.exception.code,409);self.assertIn('busy',json.load(error.exception)['error'])
            finally:B.LOCK.release()
            with request('session') as response:self.assertEqual(response.status,200)
            with self.assertRaises(HTTPError) as error:request('chat',cookie='piq_local=invalid')
            self.assertEqual(error.exception.code,401)
        finally:server.shutdown();server.server_close();thread.join()
    @patch.object(B,'reserve')
    @patch.object(B,'upstream',return_value={'models':[{'name':B.MODEL}]})
    @patch.object(B.subprocess,'run')
    def test_resident_assistant_is_not_unloaded_or_competed_with(self,run,upstream,reserve):
        with self.assertRaisesRegex(RuntimeError,'GPU busy'): B.classify(['Rent Roll'])
        run.assert_not_called()
        self.assertEqual(upstream.call_count,1)
    def test_strict_labels(self):
        for label in B.LABELS:
            self.assertEqual(B.validate_classification({'raw':label,'eos':True})['label'],label)
        for raw,eos in [('Rent Roll trailing text',True),('Rent Roll',False),('<script>',True)]:
            self.assertFalse(B.validate_classification({'raw':raw,'eos':eos})['valid'])
    @patch.object(B,'reserve')
    @patch.object(B,'upstream')
    def test_calculation_requires_confirmation_and_fixed_tool(self,upstream,reserve):
        for data in [{},{'approved':'true'},{'approved':True,'tool':'shell'},{'approved':True,'tool':'income-noi','inputs':None}]:
            with self.assertRaises(ValueError): B.dispatch('/api/local-ai/calculate',data)
        upstream.assert_not_called()
        result=B.dispatch('/api/local-ai/calculate',{'approved':True,'tool':'income-noi','inputs':{'reviewed':'value'}})
        self.assertTrue(result['verified_calculation'])
        self.assertIn('127.0.0.1:8000/v1/income-noi',upstream.call_args.args[0])
    @patch.object(B,'reserve')
    @patch.object(B,'upstream')
    def test_chat_routes_only_to_4b(self,upstream,reserve):
        upstream.return_value={'model':B.MODEL,'message':{'content':'Explanation'}}
        result=B.dispatch('/api/local-ai/chat',{'question':'Explain vacancy'})
        self.assertEqual(upstream.call_args.args[1]['model'],B.MODEL)
        self.assertNotIn('tools',upstream.call_args.args[1])
        self.assertFalse(result['verified_calculation'])
    @patch.object(B.shutil,'disk_usage')
    def test_reserve_fails_closed(self,usage):
        usage.return_value.free=12*2**30-1
        with self.assertRaises(ValueError): B.reserve()
    def test_http_rejects_foreign_origin_and_host(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),B.Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            for origin,host in [('https://evil.example','127.0.0.1:8766'),(B.ORIGIN,'evil.example')]:
                req=Request(f'http://127.0.0.1:{server.server_port}/api/local-ai/chat',data=b'{}',headers={'Origin':origin,'Host':host,'Content-Type':'application/json'})
                with self.assertRaises(HTTPError) as error: urlopen(req)
                self.assertEqual(error.exception.code,403)
        finally: server.shutdown();server.server_close();thread.join()

if __name__=='__main__': unittest.main()
