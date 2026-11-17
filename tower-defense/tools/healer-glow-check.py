"""治疗帧的光晕必须在透明留边内，不能贴着图集格边被截断。"""
import importlib.util
from pathlib import Path
import numpy as np

root = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('atlas', root / 'gen-shiba-atlas.py')
atlas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(atlas)
frame = np.asarray(atlas.healer_frame('heal'))
alpha = frame[:, :, 3]
assert alpha[0].max() == 0 and alpha[-1].max() == 0, '上下必须有透明留边'
assert alpha[:, 0].max() == 0 and alpha[:, -1].max() == 0, '左右必须有透明留边'
assert ((alpha > 0) & (alpha < 16)).any(), '保留低透明光晕'
print('治疗光晕：透明留边与低透明边缘通过')
