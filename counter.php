<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

const BASE_VIEWS = 2709;
const VIEW_COOLDOWN = 86400; // 24h
const KEEP_VISITOR_HASHES = 2592000; // 30 days

$dir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
$file = $dir . DIRECTORY_SEPARATOR . 'views.json';
$lockFile = $dir . DIRECTORY_SEPARATOR . '.views.lock';

if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
    http_response_code(500);
    echo json_encode(['views' => BASE_VIEWS, 'counted' => false]);
    exit;
}

$lock = @fopen($lockFile, 'c+');
if (!$lock || !flock($lock, LOCK_EX)) {
    http_response_code(500);
    echo json_encode(['views' => BASE_VIEWS, 'counted' => false]);
    exit;
}

$state = ['views' => BASE_VIEWS, 'seen' => []];
if (is_file($file)) {
    $decoded = json_decode((string)@file_get_contents($file), true);
    if (is_array($decoded)) {
        $state['views'] = max(BASE_VIEWS, (int)($decoded['views'] ?? BASE_VIEWS));
        $state['seen'] = is_array($decoded['seen'] ?? null) ? $decoded['seen'] : [];
    }
}

$now = time();
foreach ($state['seen'] as $hash => $ts) {
    if (!is_numeric($ts) || $now - (int)$ts > KEEP_VISITOR_HASHES) {
        unset($state['seen'][$hash]);
    }
}

$counted = false;
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $ip = (string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? 'unknown');
    $visitor = hash('sha256', 'binware-v1|' . $ip . '|' . $ua);
    $last = (int)($state['seen'][$visitor] ?? 0);
    if ($last === 0 || $now - $last >= VIEW_COOLDOWN) {
        $state['views']++;
        $state['seen'][$visitor] = $now;
        $counted = true;
    }
}

$tmp = $file . '.tmp';
$payload = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($payload !== false && @file_put_contents($tmp, $payload, LOCK_EX) !== false) {
    @rename($tmp, $file);
}

flock($lock, LOCK_UN);
fclose($lock);

echo json_encode(['views' => $state['views'], 'counted' => $counted], JSON_UNESCAPED_UNICODE);
