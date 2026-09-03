<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

session_name('monia_media');
session_start();

function reply(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function same_origin(): bool {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return true;
    $originHost = parse_url($origin, PHP_URL_HOST);
    $host = explode(':', $_SERVER['HTTP_HOST'] ?? '')[0];
    return is_string($originHost) && hash_equals(strtolower($host), strtolower($originHost));
}

function allowed_remote(string $url): bool {
    $parts = parse_url($url);
    if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https') return false;
    $host = strtolower((string)($parts['host'] ?? ''));
    if ($host === '') return false;
    $allowedExact = ['huggingface.co', 'hf.co', 'cdn-lfs.huggingface.co'];
    if (in_array($host, $allowedExact, true)) return true;
    return str_ends_with($host, '.hf.space') || str_ends_with($host, '.huggingface.co');
}

if (!same_origin()) reply(403, ['ok' => false, 'error' => 'origin refusée']);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $_SESSION['monia_csrf'] = bin2hex(random_bytes(24));
    $_SESSION['monia_hits'] = $_SESSION['monia_hits'] ?? [];
    reply(200, ['ok' => true, 'token' => $_SESSION['monia_csrf']]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['ok' => false, 'error' => 'méthode refusée']);

$raw = file_get_contents('php://input');
$payload = json_decode($raw ?: '', true);
if (!is_array($payload)) reply(400, ['ok' => false, 'error' => 'JSON invalide']);

$token = (string)($payload['token'] ?? '');
$sessionToken = (string)($_SESSION['monia_csrf'] ?? '');
if ($token === '' || $sessionToken === '' || !hash_equals($sessionToken, $token)) reply(403, ['ok' => false, 'error' => 'jeton invalide']);

$now = time();
$hits = array_values(array_filter((array)($_SESSION['monia_hits'] ?? []), fn($t) => is_int($t) && $t > $now - 600));
if (count($hits) >= 12) reply(429, ['ok' => false, 'error' => 'trop de sauvegardes média']);
$hits[] = $now;
$_SESSION['monia_hits'] = $hits;

$sourceUrl = trim((string)($payload['sourceUrl'] ?? ''));
$key = trim((string)($payload['key'] ?? ''));
$kind = (($payload['kind'] ?? '') === 'image') ? 'image' : 'video';
if ($sourceUrl === '' || $key === '' || !allowed_remote($sourceUrl)) reply(400, ['ok' => false, 'error' => 'source refusée']);

$root = dirname(__DIR__) . '/resources/monia/generated';
if (!is_dir($root) && !mkdir($root, 0755, true) && !is_dir($root)) reply(500, ['ok' => false, 'error' => 'dossier média indisponible']);

$tmp = tempnam(sys_get_temp_dir(), 'monia_');
if ($tmp === false) reply(500, ['ok' => false, 'error' => 'fichier temporaire indisponible']);
$fp = fopen($tmp, 'wb');
if ($fp === false) { @unlink($tmp); reply(500, ['ok' => false, 'error' => 'écriture temporaire impossible']); }

$maxBytes = $kind === 'video' ? 80 * 1024 * 1024 : 16 * 1024 * 1024;
$bytes = 0;
$contentType = '';
$ch = curl_init($sourceUrl);
curl_setopt_array($ch, [
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 4,
    CURLOPT_CONNECTTIMEOUT => 12,
    CURLOPT_TIMEOUT => 90,
    CURLOPT_USERAGENT => 'MonIA-MediaStore/1.0',
    CURLOPT_HEADERFUNCTION => function($ch, $header) use (&$contentType) {
        if (stripos($header, 'Content-Type:') === 0) $contentType = trim(substr($header, 13));
        return strlen($header);
    },
    CURLOPT_WRITEFUNCTION => function($ch, $chunk) use ($fp, &$bytes, $maxBytes) {
        $bytes += strlen($chunk);
        if ($bytes > $maxBytes) return 0;
        return fwrite($fp, $chunk);
    },
]);
$ok = curl_exec($ch);
$http = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$error = curl_error($ch);
curl_close($ch);
fclose($fp);

if ($ok === false || $http < 200 || $http >= 300 || $bytes < 256) {
    @unlink($tmp);
    reply(502, ['ok' => false, 'error' => $bytes > $maxBytes ? 'média trop volumineux' : ('téléchargement distant impossible' . ($error ? ' · ' . $error : ''))]);
}

$mime = strtolower(trim(explode(';', $contentType)[0] ?? ''));
$extensions = [
    'video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov',
    'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'
];
$ext = $extensions[$mime] ?? '';
if ($ext === '' || ($kind === 'video' && !str_starts_with($mime, 'video/')) || ($kind === 'image' && !str_starts_with($mime, 'image/'))) {
    @unlink($tmp);
    reply(415, ['ok' => false, 'error' => 'type média refusé']);
}

$name = hash('sha256', $key . '|' . $kind . '|' . $sourceUrl) . '.' . $ext;
$target = $root . '/' . $name;
if (!file_exists($target) && !rename($tmp, $target)) { @unlink($tmp); reply(500, ['ok' => false, 'error' => 'sauvegarde média impossible']); }
if (file_exists($tmp)) @unlink($tmp);

$publicUrl = '/resources/monia/generated/' . $name;
reply(200, ['ok' => true, 'url' => $publicUrl, 'bytes' => $bytes, 'mime' => $mime]);
