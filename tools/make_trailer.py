#!/usr/bin/env python3
"""Cut test/trailer_rec.js capture into the 16:9 promo: 1920x1080, 30 fps, H.264 + silent AAC, <=28 s."""
import glob, json, subprocess
raw = glob.glob('/tmp/mwtrailer/*.webm')[0]; m = dict(json.load(open('/tmp/mwtrailer/marks.json')))
s, e = m['start'] - 0.2, m['end'] + 0.3; sp = (e - s) / 27.4; dur = (e - s) / sp
import sys; out = sys.argv[1] if len(sys.argv) > 1 else '/workspace/mari-wordle/release/store/yandex/trailer_1920x1080.mp4'
vf = f"trim=start={s:.2f}:end={e:.2f},setpts=(PTS-STARTPTS)/{sp:.4f},fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,fade=t=in:st=0:d=0.3,fade=t=out:st={dur-0.6:.2f}:d=0.6"
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-vf', vf, '-map', '0:v', '-map', '1:a', '-t', f'{dur:.2f}',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', out], check=True)
print(out, 'speed', round(sp, 2), 'duration', round(dur, 2))
