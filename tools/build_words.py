#!/usr/bin/env python3
"""Build Mari Words word lists from the Мут тӱня dictionary pipeline (/workspace/mari-wow).
answers  = common native nouns with a dictionary card (translation+example), no religion/offensive/loans/proper names
allowed  = every valid word of that length: hunspell lemmas + 10-vol & VU2003 headwords + forms attested in mhr.wikipedia/Зорина
Output: data/words.js (window.WORDS), data/cards.js (cards for answers), data/stats.json"""
import sys, json, re, collections, os, random
sys.path.insert(0, '/workspace/mari-wow/tools')
import lexicon as L
from religion_filter import religious, GLOSS_RE, STOP_WORDS, STOP_RE
def rel_text(t):
    return bool(GLOSS_RE.search(t or '')) or any(x in STOP_WORDS or STOP_RE.match(x) for x in re.findall(r'[а-яёӓӧӱҥӹ]+', (t or '').lower()))
S = L.S; OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_CODE = {'fu-lab': 'ud10', 'fulab': 'ud10', 'vu2003': 'vu2003', 'marilab': 'vu2003'}
ALPH = re.compile(r'^[абвгдежзийклмнопрстуфхцчшщъыьэюяӓӧӱҥӹ]+$')
LENS = range(3, 9)
pos = {}
for l in open(f'{S}/assets/dicts/mk_meadow_words.dic', encoding='utf-8').read().split('\n')[1:]:
    w, _, fl = l.partition('/')
    if w: pos.setdefault(w, fl[:1])
def clue(w): return (L.UD[w]['g'] if w in L.UD else '') or ''
def has_example(w): return any(x['ex'] for h in L.UD[w]['card']['hom'] for x in h['senses'])
answers = collections.defaultdict(list); rej = collections.Counter()
for w, e in L.lex.items():
    if not ALPH.match(w) or len(w) not in LENS: continue
    if pos.get(w) != 'N': rej['not_noun'] += 1; continue
    if e['b']: rej['loan_or_nonhead'] += 1; continue
    if w not in L.UD or not L.UD[w]['g'] or not has_example(w): rej['no_card'] += 1; continue
    if religious(w, clue(w)): rej['religious'] += 1; continue
    if L.offensive(w): rej['offensive'] += 1; continue
    if re.search(r'собств|имя|фамил', clue(w)): rej['proper'] += 1; continue
    if w in L.ru_lemmas and w not in L.MARI_HOMOGRAPHS: rej['russian_loan'] += 1; continue
    if e['f'] < 3: rej['rare'] += 1; continue
    answers[len(w)].append(w)
allowed = collections.defaultdict(set)
cands = set(L.lex) | set(L.UD) | set(L.VU) | {w for w, f in L.freq.items() if f >= 2} | {w for w, f in L.zfreq.items() if f >= 1}
for w in cands:
    w = w.lower()
    if ALPH.match(w) and len(w) in LENS and not L.offensive(w): allowed[len(w)].add(w)
random.seed(2026)
words = {}; stats = {'answers': {}, 'allowed': {}, 'rejected': dict(rej)}
for n in LENS:
    a = sorted(answers[n], key=lambda w: -L.score(w))[:700]
    a.sort(); random.shuffle(a)              # fixed order -> day index picks deterministically
    al = sorted(allowed[n] | set(a))
    words[n] = {'a': a, 'g': ' '.join(x for x in al if x not in set(a))}
    stats['answers'][n] = len(a); stats['allowed'][n] = len(al)
def compact(card):
    homs = []
    for h in card['hom']:
        ss = [dict(n=x['n'], l=x['lab'], d=x['d'][:200], e=[[e[0][:160], e[1][:160], e[2][:30]] for e in [e for e in x['ex'] if not rel_text(e[0]) and not rel_text(e[1])][:1]]) for x in h['senses'][:3] if (x['d'] or x['ex']) and not rel_text(x['d'])]
        if ss: homs.append(ss)
    return dict(s=card.get('stress', ''), g=card.get('gram', ''), m=homs[:2], src=SRC_CODE.get(card.get('src', '').split(':')[0], 'ud10'))
cards = {w: compact(L.UD[w]['card']) for n in LENS for w in words[n]['a']}
glos = {w: re.sub(r'^\s*(?:\d+[).]\s*)+', '', L.UD[w]['g'])[:80] for w in cards}
os.makedirs(f'{OUT}/data', exist_ok=True)
open(f'{OUT}/data/words.js', 'w').write('window.WORDS=' + json.dumps(words, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(f'{OUT}/data/cards.js', 'w').write('window.CARDS=' + json.dumps(cards, ensure_ascii=False, separators=(',', ':')) + ';\nwindow.GLOSS=' + json.dumps(glos, ensure_ascii=False, separators=(',', ':')) + ';\n')
json.dump(stats, open(f'{OUT}/data/stats.json', 'w'), ensure_ascii=False, indent=1)
open(f'{OUT}/data/answers.tsv', 'w').write(''.join(f'{w}\t{glos[w]}\n' for n in LENS for w in sorted(words[n]['a'])))
print(json.dumps(stats, ensure_ascii=False))
