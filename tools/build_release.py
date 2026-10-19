#!/usr/bin/env python3
"""Builds of Марий мут.
  python3 tools/build_release.py yandex          -> release/build/yandex/ + release/mari-wordle-yandex.zip (no links, no Metrika, Yandex SDK)
  python3 tools/build_release.py android         -> android/app/src/main/assets/www/ (no Metrika)
  python3 tools/build_release.py web [--test]    -> release/build/web/ (Metrika 108319724; --test = noindex + «тестовая версия» badge + test hooks)
"""
import os, re, sys, shutil, time, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
target = sys.argv[1]; TEST = '--test' in sys.argv
V = time.strftime('%Y%m%d%H%M')
out = {'yandex': 'release/build/yandex', 'android': 'android/app/src/main/assets/www', 'web': 'release/build/web'}[target]
shutil.rmtree(out, ignore_errors=True); os.makedirs(out + '/js/adapters'); os.makedirs(out + '/data'); os.makedirs(out + '/img')
shutil.copytree('css', out + '/css', dirs_exist_ok=True)
for f in ('icon.png', 'ornament.svg'): shutil.copy('img/' + f, out + '/img/')
for f in ('words.js', 'cards.js'): shutil.copy('data/' + f, out + '/data/')
for f in ('platform.js', 'sound.js', 'lb.js', 'app.js'): shutil.copy('js/' + f, out + '/js/')
if target in ('yandex', 'android'): shutil.copy(f'js/adapters/{target}.js', out + f'/js/adapters/{target}.js')
s = open('index.html', encoding='utf-8').read()
s = re.sub(r'(src|href)="((?:js|css|data)/[^"?]+)"', lambda m: f'{m.group(1)}="{m.group(2)}?v={V}"', s)
pre = f'<script>{"" if TEST else "window.RELEASE=true;"}window.BUILD_V="{V}";</script>\n'
if target == 'yandex': pre = '<script src="/sdk.js"></script>\n' + pre
s = s.replace('<script src="js/platform.js', pre + '<script src="js/platform.js', 1)
if target in ('yandex', 'android'):
    s = re.sub(r'(<script src="js/platform\.js[^"]*"></script>)', lambda m: m.group(1) + f'\n<script src="js/adapters/{target}.js?v={V}"></script>', s, count=1)
if target == 'web':
    ym = ('<script>window.YM_ID=108319724;(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();'
          'for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})'
          '(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=108319724","ym");ym(108319724,"init",{ssr:true,webvisor:true,clickmap:true,referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});</script>\n'
          '<noscript><div><img src="https://mc.yandex.ru/watch/108319724" style="position:absolute;left:-9999px" alt=""></div></noscript>\n</body>')
    s = s.replace('</body>', ym, 1)
    if TEST:
        s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">', 1)
        s = s.replace('</body>', '<div id="testBadge" style="position:fixed;right:6px;bottom:4px;pointer-events:none;font:700 10px/1.4 system-ui,sans-serif;color:#fff;background:rgba(210,58,68,.85);padding:1px 7px;border-radius:8px">тестовая версия</div>\n</body>', 1)
    shutil.copytree('site/privacy', out + '/privacy')
open(out + '/index.html', 'w', encoding='utf-8').write(s)
if target == 'yandex':
    for rel in ('js/app.js', 'js/platform.js'):
        p = out + '/' + rel; t = open(p, encoding='utf-8').read()
        t = t.replace("'https://pirogovlab.ru/mari-wordle/'", 'null')
        t = re.sub(r"'<a href=\"https://pirogovlab\.ru/mari-wordle/privacy/\"[^']*</a>'", "'Политика конфиденциальности'", t)
        t = t.replace("'dict.fu-lab.ru'", "'Fu-Lab'")
        open(p, 'w', encoding='utf-8').write(t)
bad = []
for dp, _, fs in os.walk(out):
    for f in fs:
        if not f.endswith(('.html', '.js', '.css')): continue
        p = os.path.join(dp, f); t = open(p, encoding='utf-8', errors='ignore').read()
        if target != 'web' and ('mc.yandex' in t or '108319724' in t): bad.append(p + ': Metrika outside web build')
        if (target != 'web' or not TEST) and f.endswith('.html') and ('testBadge' in t or 'noindex' in t): bad.append(p + ': test badge/noindex')
        if target == 'yandex' and '/data/' not in p:
            for m in re.finditer(r'https?://[^\s"\'`<>)]+|\b[\w.-]*(?:pirogovlab|fu-lab|wiktionary|wikipedia|vk|rustore)[\w-]*\.(?:ru|com|org|net)\b', t, re.I):
                if 'w3.org' in m.group(0): continue
                if m.group(0) == 'https://pirogovlab.ru/api/mari-wordle/' and f == 'lb.js': continue   # leaderboard API (fetch, not a link; rule 8.4.2 is about links)
                bad.append(f'{p}: external ref {m.group(0)}')
if 'window.RELEASE=true' in s and 'if (!window.RELEASE) window.mutTushto' not in open(out + '/js/app.js').read(): bad.append('hooks not guarded')
if bad: print('\n'.join(bad)); sys.exit('build_release: ABORT')
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
print(f'build_release {target}{" test" if TEST else ""}: {out} v={V} {size/1e6:.1f} MB')
if target == 'yandex':
    z = 'release/mari-wordle-yandex.zip'
    if os.path.exists(z): os.remove(z)
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for dp, _, fs in os.walk(out):
            for f in sorted(fs): p = os.path.join(dp, f); zf.write(p, os.path.relpath(p, out))
    print(f'zip: {z} {os.path.getsize(z)/1e6:.2f} MB')
