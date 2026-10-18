"""Bounded live API switching/concurrency checks. Does not unload Ollama models."""
import json,subprocess,threading,time
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import bridge as B
OUT=Path(__file__).resolve().parents[2]/'docs/step18-1'

def main():
    report={'samples':[],'checks':[]};cookie=None
    def post(operation,data):
        headers={'Origin':B.ORIGIN,'Content-Type':'application/json'}
        if cookie:headers['Cookie']=cookie
        req=Request('http://127.0.0.1:8766/api/local-ai/'+operation,data=json.dumps(data).encode(),headers=headers)
        with urlopen(req,timeout=250) as response:return json.load(response),response.headers
    _,headers=post('session',{})
    cookie=headers['Set-Cookie'].split(';')[0]
    running=threading.Event();running.set()
    def sample():
        while running.is_set():
            value=subprocess.check_output(['nvidia-smi','--query-gpu=memory.used,memory.free,memory.total','--format=csv,noheader,nounits'],text=True)
            report['samples'].append({'time':time.time(),'mib':[int(x.strip()) for x in value.strip().split(',')]})
            time.sleep(.5)
    monitor=threading.Thread(target=sample,daemon=True);monitor.start()
    def chat(question):
        start=time.monotonic();value,_=post('chat',{'question':question});value['wall_seconds']=time.monotonic()-start
        assert value['model']==B.MODEL and value['verified_calculation'] is False
        return value
    try:
        report['first_4b']=chat('In one sentence, explain why extracted financial figures require human review. Do not calculate numbers.')
        report['resident_before_cpu']=B.upstream('http://127.0.0.1:11434/api/ps')
        assert report['resident_before_cpu']['models']
        try:post('classify',{'text':'Rent Roll. Unit number and monthly rent.','device':'cuda'});raise AssertionError('GPU busy guard failed')
        except HTTPError as error:
            assert error.code==422
            report['gpu_busy']=json.load(error)
        result={}
        def cpu():
            try:
                start=time.monotonic();value,_=post('classify',{'text':'Rent Roll. Unit number | Current monthly rent | Lease end date.','device':'cpu'})
                result.update(value);result['wall_seconds']=time.monotonic()-start
            except Exception as error:result['error']=repr(error)
        worker=threading.Thread(target=cpu);worker.start();time.sleep(1)
        try:post('chat',{'question':'This conflicting request must not run.'});raise AssertionError('Concurrent request was accepted')
        except HTTPError as error:
            assert error.code==409
            report['concurrent_rejection']=json.load(error)
        worker.join(250);assert not worker.is_alive() and 'error' not in result,result
        assert result['device']=='cpu' and result['peak_allocated_gib']==0
        report['cpu_with_4b_resident']=result
        report['resident_after_cpu']=B.upstream('http://127.0.0.1:11434/api/ps')
        before=report['resident_before_cpu']['models'][0];after=report['resident_after_cpu']['models'][0]
        assert before['digest']==after['digest'] and before['expires_at']==after['expires_at'],'Existing model residency changed'
        report['second_4b']=chat('Briefly explain the difference between an operating statement and a rent roll. Do not perform calculations.')
        report['checks']=['GPU request refused with resident model','CPU fallback worked with the original 4B resident and unchanged expiry','Concurrent local request rejected with JSON 409','4B remained available after CPU fallback']
    finally:
        running.clear();monitor.join(5)
        report['peak_device_used_mib']=max(s['mib'][0] for s in report['samples'])
        (OUT/'switching-results.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='samples'}))

if __name__=='__main__':main()
