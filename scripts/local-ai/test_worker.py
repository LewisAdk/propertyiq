"""Exercise real preflight branches with fake device APIs; never allocate GPU memory."""
import importlib.util,io,json,sys,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch,Mock

class WorkerPreflightTests(unittest.TestCase):
    def worker(self,cuda):
        fake=SimpleNamespace(cuda=cuda)
        spec=importlib.util.spec_from_file_location('fixture_worker',Path(__file__).with_name('model_worker.py'))
        module=importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules,{'torch':fake,'transformers':SimpleNamespace(AutoModelForCausalLM=Mock(),AutoTokenizer=Mock()),'repair_token_rows':SimpleNamespace(load_repair=Mock())}):spec.loader.exec_module(module)
        return module
    def test_cuda_unavailable_fails_before_loading(self):
        module=self.worker(SimpleNamespace(is_available=lambda:False))
        with patch.object(sys,'stdin',io.StringIO('{"device":"cuda"}')):
            with self.assertRaisesRegex(RuntimeError,'CUDA unavailable'):module.main()
        module.AutoModelForCausalLM.from_pretrained.assert_not_called()
    def test_insufficient_vram_fails_before_loading(self):
        module=self.worker(SimpleNamespace(is_available=lambda:True,get_device_name=lambda _: 'RTX 2080 SUPER',mem_get_info=lambda:(1024,8192)))
        with patch.object(sys,'stdin',io.StringIO('{"device":"cuda"}')):
            with self.assertRaisesRegex(RuntimeError,'GPU busy'):module.main()
        module.AutoModelForCausalLM.from_pretrained.assert_not_called()
    def test_insufficient_cpu_ram_fails_before_loading(self):
        module=self.worker(SimpleNamespace())
        with patch.object(sys,'stdin',io.StringIO('{"device":"cpu"}')),patch.object(module.Path,'read_text',return_value='MemAvailable: 1000 kB'):
            with self.assertRaisesRegex(RuntimeError,'Insufficient available RAM'):module.main()
        module.AutoModelForCausalLM.from_pretrained.assert_not_called()

if __name__=='__main__':unittest.main()
