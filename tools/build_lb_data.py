#!/usr/bin/env python3
"""Server data for the shared leaderboard (api/mari-wordle):
 server/words.json   - answers (same order as data/words.js, needed to recompute the daily word) + valid guesses per length
 server/bad_mhr.json - Mari words that are only crude/abusive in the dictionary (all senses labelled бран./груб./вульг.
                       or obscene anatomy), used by the nickname filter as whole tokens."""
import json, re, subprocess, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
js = open(os.path.join(ROOT, 'data/words.js'), encoding='utf-8').read()
W = json.loads(js[js.index('{'):js.rindex('}') + 1])
out = {L: {'a': W[L]['a'], 'g': sorted(set(W[L]['a']) | set((W[L].get('g') or '').split()) - {''})} for L in W}
json.dump(out, open(os.path.join(ROOT, 'server/words.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
bad = set()
src = '/workspace/mari-wow/src/fulab/cards_fulab.json'
if os.path.exists(src):
    crude = re.compile(r'(^|[\s,(])(бран|груб|вульг)\.')
    obsc = re.compile(r'половой орган|половые органы|половой член|задний проход|мошонк|влагалищ|пенис|проститутк|шлюх|сука\b')
    for e in json.load(open(src, encoding='utf-8')):
        w = e['w'].strip().lower()
        if ' ' in w or '-' in w or len(w) < 3: continue
        ss = e.get('senses') or []
        if not ss: continue
        if all(crude.search(s.get('lab', '') + ' ' + s.get('d', '')[:12]) for s in ss) or any(obsc.search(s.get('d', '')) for s in ss):
            bad.add(w)
# false positives of the automatic pass («пениться», given names, everyday words)
bad -= {'лаемалташ', 'макар', 'ота', 'укш', 'шораш'} | {w for w in bad if w.startswith('шоҥ')}
# words labelled бран. in the dictionary that also have neutral senses but are clearly insults in a nickname
bad |= set('албаста зараза йырнык келтӹмӓш курчаҥге кӱзылык моклака нолнер нӧнчык овда панкрут пелторта пинеге полган пундыш пӱрыдымӧ пызлаҥге сӧрма сӱзлӧ таргылтыш токмак триспотня урлык шакше шырт эмгак эрзе явыл яришка'.split())
json.dump(sorted(bad), open(os.path.join(ROOT, 'server/bad_mhr.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print({L: (len(v['a']), len(v['g'])) for L, v in out.items()}, 'bad_mhr', len(bad))
