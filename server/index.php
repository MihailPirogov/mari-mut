<?php
/* Марий мут — common leaderboard API (PirogovLab). One file, JSON storage with flock, no DB.
 *   GET  ?a=board&len=5[&pid=..]          -> today's daily table for that length + all-time wins + streaks
 *   POST {a:"name",  pid,key,name}          -> set / change nickname (opt-in; nothing is stored before that)
 *   POST {a:"delete",pid,key}            -> remove the player, nickname and all results
 *   POST {a:"submit",pid,key,name?,day,len,g:[guesses],x:extra} -> one daily result; verified on the server
 * Anti-cheat: the server recomputes the daily answer from day+len (same formula as the game), checks every guess
 * against the dictionary, the attempts limit (6, or 7 after the rewarded «ещё попытка»), win/loss consistency,
 * only today and the last 7 days (offline queue), one result per player per day+length, per-player secret key,
 * rate limit per IP and per player. (The answers ship with the offline game, so a determined cheater can still
 * submit perfect rounds; 1-attempt wins are shown but counted separately.)
 */
declare(strict_types=1);
define('DAY0', (int)(getenv('MW_DAY0') ?: 20745));   // floor(Date.UTC(2026,9,19)/864e5): Задача дня №1 = 19.10.2026 (env only for tests)
const LATE_DAYS = 7;                     // accept queued offline results up to a week old
const TOP = 50;
$DATA = getenv('MW_DATA') ?: '/var/www/www-root/data/mari-wordle-private';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');            // web, Android WebView (appassets.androidplatform.net), Yandex Games iframe
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }

function out(int $code, array $j): void { http_response_code($code); echo json_encode($j, JSON_UNESCAPED_UNICODE); exit; }
function mskDay(?int $t = null): int { return intdiv(($t ?? time()) + 3 * 3600, 86400); }
function jload(string $f, $def) { if (!is_file($f)) return $def; $j = json_decode((string)file_get_contents($f), true); return $j === null ? $def : $j; }
function jsave(string $f, $v): void { $tmp = $f . '.tmp' . getmypid(); file_put_contents($tmp, json_encode($v, JSON_UNESCAPED_UNICODE)); rename($tmp, $f); }
function words(): array { static $w = null; global $DATA; if ($w === null) { $w = jload("$DATA/words.json", []); foreach ($w as $L => $v) $w[$L]['set'] = array_flip($v['g']); } return $w; }
function dailyWord(int $len, int $day): ?string { $a = words()[(string)$len]['a'] ?? null; if (!$a) return null; $n = count($a); return $a[(((($day - DAY0) + $len * 37) % $n) + $n) % $n]; }
function lower(string $s): string { return mb_strtolower(trim($s), 'UTF-8'); }

/* ---------- nickname filter ---------- */
function nickProblem(string $name): ?string {
  global $DATA;
  $n = trim(preg_replace('/\s+/u', ' ', $name));
  $len = mb_strlen($n, 'UTF-8');
  if ($len < 2 || $len > 16) return 'Ник: от 2 до 16 символов';
  if (!preg_match('/^[\p{Cyrillic}A-Za-z0-9 _.\-]+$/u', $n)) return 'Можно буквы (кириллица, латиница), цифры, пробел, _ . -';
  if (!preg_match('/[\p{Cyrillic}A-Za-z]/u', $n)) return 'В нике нужна хотя бы одна буква';
  $low = lower($n);
  // fold look-alikes / leetspeak into Cyrillic, drop separators, collapse repeats
  $map = ['a'=>'а','b'=>'в','c'=>'с','e'=>'е','h'=>'н','k'=>'к','m'=>'м','o'=>'о','p'=>'р','t'=>'т','x'=>'х','y'=>'у','u'=>'и','n'=>'п','r'=>'г','3'=>'з','0'=>'о','4'=>'ч','6'=>'б','@'=>'а','ё'=>'е','й'=>'и','ӓ'=>'а','ӧ'=>'о','ӱ'=>'у','ӹ'=>'ы','ҥ'=>'н'];
  $cyr = preg_replace('/[^\p{Cyrillic}]/u', '', strtr($low, $map));
  $cyr = preg_replace('/(.)\1+/u', '$1', $cyr);
  // second fold: Latin transliteration (pizda, zhopa, mixed «пиzда»)
  $tr = strtr($low, ['zh'=>'ж','ch'=>'ч','sh'=>'ш','ya'=>'я','yu'=>'ю','a'=>'а','b'=>'б','v'=>'в','g'=>'г','d'=>'д','e'=>'е','z'=>'з','i'=>'и','k'=>'к','l'=>'л','m'=>'м','n'=>'н','o'=>'о','p'=>'п','r'=>'р','s'=>'с','t'=>'т','u'=>'у','f'=>'ф','h'=>'х','c'=>'ц','y'=>'ы','x'=>'х','j'=>'и','w'=>'в','q'=>'к','0'=>'о','3'=>'з','ё'=>'е','й'=>'и','ӓ'=>'а','ӧ'=>'о','ӱ'=>'у','ӹ'=>'ы','ҥ'=>'н']);
  $cyr .= '|' . preg_replace('/(.)\1+/u', '$1', preg_replace('/[^\p{Cyrillic}]/u', '', $tr));
  $lat = preg_replace('/[^a-z]/', '', strtr($low, ['0'=>'o','1'=>'i','3'=>'e','4'=>'a','5'=>'s','@'=>'a','$'=>'s','!'=>'i']));
  $ru = ['хуи','хуе','хуя','хую','пизд','пезд','бля','блиа','ебат','ебан','ебал','ебуч','ебну','ебл','уеб','заеб','выеб','поеб','разеб','мудак','мудил','пидор','пидар','педик','педр','гандон','гондон','залуп','шлюх','шалав','дроч','манда','жопа','жопу','жопе','сучк','сука','суки','сучар','шмар','говн','гавн','дерьм','срак','перд','дебил','уебок','урод','чмо','тварь','мраз','гнид','нацис','фашис','гитлер','хохол','ниггер','чурк','порн','секс','вагин','насил','убива','наркот','кокаин','гашиш','админ','модерат','пироговлаб'];
  $whitelist = ['корабл','оскорбля','сукно','скребл'];   // obvious false positives
  foreach ($whitelist as $w) $cyr = str_replace($w, '', $cyr);
  foreach ($ru as $r) if (mb_strpos($cyr, $r) !== false) return 'Этот ник нельзя использовать';
  $en = ['fuck','fuk','shit','bitch','cunt','dick','cock','pussy','whore','slut','nigg','fag','porn','sex','nazi','hitler','rape','pizd','pisd','huy','hui','xuy','xui','blya','blia','ebat','eban','ebal','yeban','suka','mudak','pidor','pidar','zhop','gandon','eblan','admin','moderat','pirogovlab','yandex','support'];
  foreach ($en as $r) if (strpos($lat, $r) !== false) return 'Этот ник нельзя использовать';
  $mhr = jload("$DATA/bad_mhr.json", []);
  if ($mhr) { $set = array_flip($mhr); foreach (preg_split('/[^\p{Cyrillic}]+/u', $low, -1, PREG_SPLIT_NO_EMPTY) as $tok) if (isset($set[$tok])) return 'Этот ник нельзя использовать'; }
  return null;
}

/* ---------- storage (one lock for all writes) ---------- */
@mkdir($DATA . '/days', 0750, true);
$lock = fopen("$DATA/.lock", 'c');
function withLock(callable $f) { global $lock; flock($lock, LOCK_EX); try { return $f(); } finally { flock($lock, LOCK_UN); } }

function rateOk(string $bucket, int $max, int $win): bool {   // sliding window per IP / per player
  global $DATA; $f = "$DATA/rate.json"; $r = jload($f, []); $now = time();
  foreach ($r as $k => $ts) { $r[$k] = array_values(array_filter($ts, fn($t) => $t > $now - 3600)); if (!$r[$k]) unset($r[$k]); }
  $ts = array_filter($r[$bucket] ?? [], fn($t) => $t > $now - $win);
  if (count($ts) >= $max) { jsave($f, $r); return false; }
  $r[$bucket][] = $now; jsave($f, $r); return true;
}
function streaks(array $days, int $today): array {   // days with ≥1 daily win -> [current, best]
  $days = array_values(array_unique(array_map('intval', $days))); sort($days);
  $best = 0; $run = 0; $prev = null;
  foreach ($days as $d) { $run = ($prev !== null && $d === $prev + 1) ? $run + 1 : 1; $best = max($best, $run); $prev = $d; }
  $cur = ($prev !== null && $prev >= $today - 1) ? $run : 0;
  return [$cur, $best];
}
function auth(array &$players, string $pid, string $key, bool $create) {
  if (!preg_match('/^[a-f0-9]{32}$/', $pid) || !preg_match('/^[a-f0-9]{32}$/', $key)) out(400, ['ok' => false, 'err' => 'bad_id']);
  $kh = hash('sha256', $key);
  if (isset($players[$pid])) { if (!hash_equals($players[$pid]['kh'], $kh)) out(403, ['ok' => false, 'err' => 'bad_key']); return; }
  if (!$create) out(404, ['ok' => false, 'err' => 'no_player']);
  $players[$pid] = ['kh' => $kh, 'name' => null, 'since' => mskDay(), 'wins' => 0, 'played' => 0, 'ones' => 0, 'wd' => []];
}
function setName(array &$players, string $pid, string $name): void {
  $name = trim(preg_replace('/\s+/u', ' ', $name));
  if ($p = nickProblem($name)) out(422, ['ok' => false, 'err' => 'name', 'msg' => $p]);
  $low = lower($name);
  foreach ($players as $id => $p) if ($id !== $pid && $p['name'] !== null && lower($p['name']) === $low) out(409, ['ok' => false, 'err' => 'name_taken', 'msg' => 'Этот ник уже занят']);
  $players[$pid]['name'] = $name;
}

$ip = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|mw');   // IPs are never stored in clear text
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  $a = $_GET['a'] ?? 'board';
  if ($a === 'ping') out(200, ['ok' => true, 'today' => mskDay()]);
  if ($a === 'check') { $p = nickProblem((string)($_GET['name'] ?? '')); out(200, ['ok' => $p === null, 'msg' => $p]); }
  if ($a !== 'board') out(400, ['ok' => false, 'err' => 'bad_action']);
  $len = (int)($_GET['len'] ?? 5); if ($len < 3 || $len > 8) $len = 5;
  $today = mskDay(); $day = (int)($_GET['day'] ?? $today); if ($day > $today || $day < $today - 30) $day = $today;
  $me = (string)($_GET['pid'] ?? '');
  $players = jload("$DATA/players.json", []);
  $res = jload("$DATA/days/$day.json", []);
  $name = fn($pid) => $players[$pid]['name'] ?? null;
  // today's table: winners first, fewer attempts, earlier submission
  $rows = [];
  foreach (($res[(string)$len] ?? []) as $pid => $r) { if ($name($pid) === null) continue; $rows[] = ['pid' => $pid, 'n' => $name($pid), 'g' => $r['g'], 'w' => $r['w'], 't' => $r['t']]; }
  usort($rows, fn($x, $y) => [$y['w'], $x['w'] ? $x['g'] : 99, $x['t']] <=> [$x['w'], $y['w'] ? $y['g'] : 99, $y['t']]);
  $rank = function (array $rows, string $me, callable $pub): array { $top = []; $mine = null;
    foreach ($rows as $i => $r) { $e = $pub($r) + ['r' => $i + 1, 'me' => $r['pid'] === $me]; if ($i < TOP) $top[] = $e; if ($r['pid'] === $me) $mine = $e; }
    return ['top' => $top, 'me' => $mine, 'total' => count($rows)]; };
  $daily = $rank($rows, $me, fn($r) => ['n' => $r['n'], 'g' => $r['g'], 'w' => $r['w']]);
  $all = [];
  foreach ($players as $pid => $p) { if ($p['name'] === null || !$p['played']) continue; [$cur, $best] = streaks($p['wd'], $today);
    $all[] = ['pid' => $pid, 'n' => $p['name'], 'wins' => $p['wins'], 'played' => $p['played'], 'cur' => $cur, 'best' => $best]; }
  $byWins = $all; usort($byWins, fn($x, $y) => [$y['wins'], $x['played'], $x['n']] <=> [$x['wins'], $y['played'], $y['n']]);
  $byStreak = array_values(array_filter($all, fn($r) => $r['cur'] > 0 || $r['best'] > 0));
  usort($byStreak, fn($x, $y) => [$y['cur'], $y['best'], $y['wins']] <=> [$x['cur'], $x['best'], $x['wins']]);
  out(200, ['ok' => true, 'today' => $today, 'day' => $day, 'no' => $day - DAY0 + 1, 'len' => $len,
    'me' => isset($players[$me]) ? ['n' => $players[$me]['name']] : null,
    'daily' => $daily,
    'wins' => $rank($byWins, $me, fn($r) => ['n' => $r['n'], 'wins' => $r['wins'], 'played' => $r['played']]),
    'streaks' => $rank($byStreak, $me, fn($r) => ['n' => $r['n'], 'cur' => $r['cur'], 'best' => $r['best']])]);
}

if ($method !== 'POST') out(405, ['ok' => false, 'err' => 'method']);
$raw = file_get_contents('php://input', false, null, 0, 8192);
$in = json_decode((string)$raw, true);
if (!is_array($in)) out(400, ['ok' => false, 'err' => 'bad_json']);
$pid = (string)($in['pid'] ?? ''); $key = (string)($in['key'] ?? '');
$act = (string)($in['a'] ?? '');

withLock(function () use ($in, $pid, $key, $act, $ip, $DATA) {
  if (!rateOk("ip:$ip", 60, 600) || !rateOk("p:" . substr($pid, 0, 32), 30, 600)) out(429, ['ok' => false, 'err' => 'rate', 'msg' => 'Слишком часто, попробуйте позже']);
  $players = jload("$DATA/players.json", []);
  if ($act === 'name') {
    auth($players, $pid, $key, true); setName($players, $pid, (string)($in['name'] ?? ''));
    jsave("$DATA/players.json", $players); out(200, ['ok' => true, 'name' => $players[$pid]['name']]);
  }
  if ($act === 'delete') {   // «Удалить меня из таблицы»: nickname, aggregates and all daily results of this player
    auth($players, $pid, $key, false); unset($players[$pid]); jsave("$DATA/players.json", $players);
    foreach (glob("$DATA/days/*.json") as $f) { $res = jload($f, []); $ch = false; foreach ($res as $L => $rows) if (isset($rows[$pid])) { unset($res[$L][$pid]); $ch = true; } if ($ch) jsave($f, $res); }
    out(200, ['ok' => true]);
  }
  if ($act !== 'submit') out(400, ['ok' => false, 'err' => 'bad_action']);
  auth($players, $pid, $key, true);
  if (isset($in['name']) && $in['name'] !== '' && $in['name'] !== $players[$pid]['name']) setName($players, $pid, (string)$in['name']);
  if ($players[$pid]['name'] === null) out(422, ['ok' => false, 'err' => 'need_name', 'msg' => 'Сначала укажите ник']);
  $today = mskDay(); $day = (int)($in['day'] ?? -1); $len = (int)($in['len'] ?? 0);
  if ($len < 3 || $len > 8) out(422, ['ok' => false, 'err' => 'bad_len']);
  if ($day > $today || $day < max(DAY0, $today - LATE_DAYS)) out(422, ['ok' => false, 'err' => 'bad_day']);
  $g = $in['g'] ?? null; $extra = !empty($in['x']);
  if (!is_array($g) || !$g) out(422, ['ok' => false, 'err' => 'bad_guesses']);
  $max = $extra ? 7 : 6;
  if (count($g) > $max) out(422, ['ok' => false, 'err' => 'too_many']);
  $ans = dailyWord($len, $day); $set = words()[(string)$len]['set'] ?? [];
  foreach ($g as $i => $w) {
    $w = is_string($w) ? lower($w) : '';
    if (mb_strlen($w, 'UTF-8') !== $len || !isset($set[$w])) out(422, ['ok' => false, 'err' => 'bad_word']);
    if ($w === $ans && $i !== count($g) - 1) out(422, ['ok' => false, 'err' => 'after_win']);
    $g[$i] = $w;
  }
  $won = end($g) === $ans;
  if (!$won && count($g) < 6) out(422, ['ok' => false, 'err' => 'unfinished']);
  if ($extra && count($g) < 7 && !$won) out(422, ['ok' => false, 'err' => 'unfinished']);
  $f = "$DATA/days/$day.json"; $res = jload($f, []);
  if (isset($res[(string)$len][$pid])) out(200, ['ok' => true, 'dup' => true]);
  $res[(string)$len][$pid] = ['g' => count($g), 'w' => $won, 'x' => $extra, 't' => time()];
  jsave($f, $res);
  $p = &$players[$pid]; $p['played']++;
  if ($won) { $p['wins']++; if (count($g) === 1) $p['ones']++; if (!in_array($day, $p['wd'], true)) $p['wd'][] = $day; sort($p['wd']); $p['wd'] = array_slice($p['wd'], -400); }
  jsave("$DATA/players.json", $players);
  [$cur, $best] = streaks($p['wd'], $today);
  out(200, ['ok' => true, 'won' => $won, 'wins' => $p['wins'], 'cur' => $cur, 'best' => $best]);
});
