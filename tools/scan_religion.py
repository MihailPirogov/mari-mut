#!/usr/bin/env python3
"""Scan answer list, allowed list (report only), glosses and word cards for religious words. Exit 1 if any answer/card hit."""
import json, os, re, sys
sys.path.insert(0, '/workspace/mari-wow/tools')
from religion_filter import religious, GLOSS_RE, STOP_WORDS, STOP_RE
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = json.loads(open(f'{R}/data/words.js').read()[len('window.WORDS='):].rstrip().rstrip(';'))
lines = open(f'{R}/data/cards.js').read().split('\n')
C = json.loads(lines[0][len('window.CARDS='):].rstrip(';')); G = json.loads(lines[1][len('window.GLOSS='):].rstrip(';'))
def rel_text(t): return bool(GLOSS_RE.search(t or '')) or any(x in STOP_WORDS or STOP_RE.match(x) for x in re.findall(r'[а-яёӓӧӱҥӹ]+', (t or '').lower()))
hits = []; n = 0
for L, d in W.items():
    for w in d['a']:
        n += 1
        if religious(w, G.get(w, '')): hits.append(('answer', w, G.get(w, '')))
        for hom in C.get(w, {}).get('m', []):
            for s in hom:
                if rel_text(s['d']): hits.append(('card-sense', w, s['d'][:60]))
                for e in s['e']:
                    if rel_text(e[0]) or rel_text(e[1]): hits.append(('card-example', w, e[1][:60]))
print(f'scanned {n} answers + their cards -> hits {len(hits)}')
for h in hits[:30]: print('  ', *h)
sys.exit(1 if hits else 0)
