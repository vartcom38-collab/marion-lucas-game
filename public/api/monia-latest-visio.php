<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$root = dirname(__DIR__) . '/resources/monia/generated';
if (!is_dir($root)) {
    http_response_code(200);
    echo json_encode(['ok' => true, 'url' => null, 'updatedAt' => null], JSON_UNESCAPED_SLASHES);
    exit;
}

$files = glob($root . '/*.{mp4,webm,mov}', GLOB_BRACE) ?: [];
if (!$files) {
    http_response_code(200);
    echo json_encode(['ok' => true, 'url' => null, 'updatedAt' => null], JSON_UNESCAPED_SLASHES);
    exit;
}

usort($files, static fn(string $a, string $b): int => filemtime($b) <=> filemtime($a));
$latest = $files[0];
$name = basename($latest);
$mtime = filemtime($latest) ?: null;

echo json_encode([
    'ok' => true,
    'url' => '/resources/monia/generated/' . rawurlencode($name),
    'updatedAt' => $mtime ? date(DATE_ATOM, $mtime) : null,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
