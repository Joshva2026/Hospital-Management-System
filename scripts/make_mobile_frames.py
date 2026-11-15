from PIL import Image
import os

SRC = 'frontend/assets/landing/hospital-sequence'
DST = 'frontend/assets/landing/hospital-sequence-mobile'
os.makedirs(DST, exist_ok=True)

for i in range(1, 193):
    name = f'frame-{i:03d}.jpg'
    im = Image.open(os.path.join(SRC, name)).convert('RGB')
    im = im.resize((960, 540), Image.LANCZOS)
    im.save(os.path.join(DST, name), 'JPEG', quality=78, optimize=True, progressive=True)

print('Created 192 mobile frames in', DST)

