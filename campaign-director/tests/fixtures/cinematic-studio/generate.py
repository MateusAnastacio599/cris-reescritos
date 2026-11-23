"""Original technical fixtures, Pillow + ffmpeg/libvpx-vp9. No downloaded art."""
from PIL import Image, ImageDraw
from pathlib import Path
import math, subprocess, tempfile
root=Path(__file__).parent
for name,size,probe in [('iris',(256,512),False),('alpha-probe',(32,32),True)]:
    with tempfile.TemporaryDirectory() as temp:
        for n in range(24):
            image=Image.new('RGBA',size,(0,0,0,0)); d=ImageDraw.Draw(image)
            if probe:d.rectangle((10,10,22,22),fill=(235,140,70,255))
            else:
                v=math.sin(n/24*math.tau)*3
                d.ellipse((86,30+v,170,115+v),fill=(232,192,166,255))
                d.polygon([(90,108+v),(166,108+v),(205,415),(51,415)],fill=(132,54,160,255))
                d.rectangle((95,415,115,494),fill=(47,30,64,255));d.rectangle((141,415,161,494),fill=(47,30,64,255))
            image.save(Path(temp)/f'{n:03}.png')
            if n==0:image.save(root/(name+'.png'))
        output=root/(name+'.webm')
        subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','12','-i',str(Path(temp)/'%03d.png'),'-c:v','libvpx-vp9','-pix_fmt','yuva420p','-auto-alt-ref','0','-b:v','0','-crf','30',str(output)],check=True)
(root/'../../../dist/assets/cinematic-alpha-probe.webm').write_bytes((root/'alpha-probe.webm').read_bytes())
