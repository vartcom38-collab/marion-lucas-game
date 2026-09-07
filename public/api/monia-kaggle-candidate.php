<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const MONIA_REPO = 'vartcom38-collab/marion-lucas-game';
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

function reply(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function bearer_token(): string {
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($header === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $name => $value) {
                if (strcasecmp((string)$name, 'Authorization') === 0) {
                    $header = (string)$value;
                    break;
                }
            }
        }
    }
    if (!preg_match('/^Bearer\s+(.+)$/i', trim($header), $m)) return '';
    return trim((string)$m[1]);
}

function github_repo_push_allowed(string $token): bool {
    if ($token === '') return false;
    $ch = curl_init('https://api.github.com/repos/' . MONIA_REPO);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => [
            'Accept: application/vnd.github+json',
            'Authorization: Bearer ' . $token,
            'X-GitHub-Api-Version: 2022-11-28',
            'User-Agent: MonIA-Kaggle-Candidate/1.0',
        ],
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($status !== 200 || !is_string($body)) return false;
    $data = json_decode($body, true);
    if (!is_array($data) || (string)($data['full_name'] ?? '') !== MONIA_REPO) return false;
    return (bool)($data['permissions']['push'] ?? false);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    reply(200, [
        'ok' => true,
        'service' => 'monia-kaggle-candidate',
        'candidateOnly' => true,
        'narrativeAuthority' => false,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['ok' => false, 'error' => 'méthode refusée']);

$token = bearer_token();
if (!github_repo_push_allowed($token)) reply(403, ['ok' => false, 'error' => 'auth GitHub refusée']);

$jobId = trim((string)($_POST['jobId'] ?? ''));
if ($jobId === '' || !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$/', $jobId)) {
    reply(400, ['ok' => false, 'error' => 'jobId invalide']);
}

$resultRaw = (string)($_POST['result'] ?? '');
$result = json_decode($resultRaw, true);
if (!is_array($result)) reply(400, ['ok' => false, 'error' => 'result JSON invalide']);
if (($result['candidateOnly'] ?? null) !== true || ($result['narrativeAuthority'] ?? null) !== false) {
    reply(400, ['ok' => false, 'error' => 'candidate-only requis']);
}
if ((string)($result['jobId'] ?? '') !== $jobId) reply(400, ['ok' => false, 'error' => 'jobId incohérent']);

if (!isset($_FILES['clip']) || !is_array($_FILES['clip'])) reply(400, ['ok' => false, 'error' => 'clip manquant']);
$clip = $_FILES['clip'];
if ((int)($clip['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) reply(400, ['ok' => false, 'error' => 'upload clip refusé']);
$tmp = (string)($clip['tmp_name'] ?? '');
$size = (int)($clip['size'] ?? 0);
if ($tmp === '' || !is_uploaded_file($tmp) || $size < 256 || $size > MAX_VIDEO_BYTES) {
    reply(400, ['ok' => false, 'error' => 'taille clip invalide']);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string)$finfo->file($tmp);
$allowed = ['video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov'];
$ext = $allowed[$mime] ?? '';
if ($ext === '') reply(415, ['ok' => false, 'error' => 'type vidéo refusé']);

$root = dirname(__DIR__) . '/resources/monia/candidates/' . $jobId;
if (!is_dir($root) && !mkdir($root, 0755, true) && !is_dir($root)) {
    reply(500, ['ok' => false, 'error' => 'dossier candidat indisponible']);
}

$videoName = 'shot-01.' . $ext;
$videoTarget = $root . '/' . $videoName;
if (!move_uploaded_file($tmp, $videoTarget)) reply(500, ['ok' => false, 'error' => 'sauvegarde vidéo impossible']);

$result['state'] = 'candidate';
$result['candidateOnly'] = true;
$result['narrativeAuthority'] = false;
$result['remoteClip'] = '/resources/monia/candidates/' . $jobId . '/' . $videoName;
$result['receivedAt'] = gmdate('c');
$resultTarget = $root . '/result.json';
if (file_put_contents($resultTarget, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX) === false) {
    @unlink($videoTarget);
    reply(500, ['ok' => false, 'error' => 'sauvegarde résultat impossible']);
}

reply(200, [
    'ok' => true,
    'candidateOnly' => true,
    'narrativeAuthority' => false,
    'jobId' => $jobId,
    'clipUrl' => $result['remoteClip'],
    'resultUrl' => '/resources/monia/candidates/' . $jobId . '/result.json',
    'bytes' => $size,
    'mime' => $mime,
]);
