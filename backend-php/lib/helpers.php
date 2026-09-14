<?php
/**
 * General helpers: JSON responses, CORS, tiny file-based cache, HTTP GET/POST.
 *
 * This backend is a plain-PHP port of the Python/FastAPI backend in
 * ../backend, built so it can run on ordinary shared/cPanel-style hosting
 * with no framework and no long-running process. Because plain PHP has no
 * persistent in-memory state between requests, the Python backend's
 * in-process caches (dicts kept alive in the running uvicorn process) are
 * replaced here with a small file-based cache under backend-php/cache/.
 * This is the main behavioral divergence from the Python version.
 */

declare(strict_types=1);

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $detail, int $status = 400): void
{
    json_response(['detail' => $detail], $status);
}

/**
 * Apply CORS headers matching main.py's CORSMiddleware config:
 * allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"].
 *
 * Note: browsers reject `Access-Control-Allow-Origin: *` together with
 * `Access-Control-Allow-Credentials: true` on credentialed requests. The
 * mobile app does not send cookies/credentials, so this mirrors the
 * Python config's intent (fully open CORS) in a browser-safe way by
 * echoing back the request Origin when present.
 */
function apply_cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH');
    header('Access-Control-Allow-Headers: *');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function query_param(string $name, ?string $default = null): ?string
{
    return isset($_GET[$name]) && $_GET[$name] !== '' ? (string)$_GET[$name] : $default;
}

/* ---------------------------------------------------------------------
 * Tiny file-based cache (stand-in for the Python backend's in-memory
 * per-process dict caches). Each cache entry is one JSON file under
 * backend-php/cache/<namespace>/<md5(key)>.json holding {"time":..,"data":..}
 * ------------------------------------------------------------------- */

function cache_dir(string $namespace): string
{
    $dir = __DIR__ . '/../cache/' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $namespace);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function cache_get(string $namespace, string $key, int $ttlSeconds)
{
    $file = cache_dir($namespace) . '/' . md5($key) . '.json';
    if (!is_file($file)) {
        return null;
    }
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return null;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || !isset($decoded['time'], $decoded['data'])) {
        return null;
    }
    if (time() - (int)$decoded['time'] > $ttlSeconds) {
        return null;
    }
    return $decoded['data'];
}

/** Returns cached data even if stale (used as a last-resort fallback), or null if none exists. */
function cache_get_stale(string $namespace, string $key)
{
    $file = cache_dir($namespace) . '/' . md5($key) . '.json';
    if (!is_file($file)) {
        return null;
    }
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return null;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) && isset($decoded['data']) ? $decoded['data'] : null;
}

function cache_set(string $namespace, string $key, $data, int $maxEntries = 300): void
{
    $dir = cache_dir($namespace);
    $file = $dir . '/' . md5($key) . '.json';
    @file_put_contents($file, json_encode(['time' => time(), 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    cache_prune($dir, $maxEntries);
}

function cache_prune(string $dir, int $maxEntries): void
{
    $files = glob($dir . '/*.json');
    if ($files === false || count($files) <= $maxEntries) {
        return;
    }
    usort($files, function ($a, $b) {
        return filemtime($a) <=> filemtime($b);
    });
    $excess = count($files) - $maxEntries;
    for ($i = 0; $i < $excess; $i++) {
        @unlink($files[$i]);
    }
}

/* ---------------------------------------------------------------------
 * Minimal HTTP client wrappers (curl). Used for the RSS news feeds,
 * forex/commodity quotes, and the Gemini/OpenAI LLM REST calls.
 * ------------------------------------------------------------------- */

function http_get(string $url, array $headers = [], float $timeout = 10.0): ?array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => (int)ceil($timeout),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false) {
        return null;
    }
    return ['status' => $status, 'body' => $body, 'error' => $err];
}

function http_post_json(string $url, array $payload, array $headers = [], float $timeout = 20.0): ?array
{
    $ch = curl_init($url);
    $headers[] = 'Content-Type: application/json';
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => (int)ceil($timeout),
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false) {
        return null;
    }
    return ['status' => $status, 'body' => $body, 'error' => $err];
}

/* ---------------------------------------------------------------------
 * Seeded pseudo-random helpers, built on PHP's mt_srand/mt_rand.
 * Mirrors the Python backend's use of a ticker-seeded RNG for
 * deterministic-per-ticker simulated data, and a freshly-seeded RNG for
 * "live-feeling" quote jitter on every call. Numeric parity with Python's
 * random/numpy generators is not required or attempted — only the same
 * algorithm shape and the same determinism property (same seed => same
 * sequence, within one PHP process).
 * ------------------------------------------------------------------- */

function seed_from_string(string $s): int
{
    $sum = 0;
    $len = strlen($s);
    for ($i = 0; $i < $len; $i++) {
        $sum += ord($s[$i]);
    }
    return $sum;
}

function rng_uniform(float $min, float $max): float
{
    return $min + (mt_rand() / mt_getrandmax()) * ($max - $min);
}

/** Box-Muller transform for a normal(mean, std) sample using mt_rand(). */
function rng_normal(float $mean, float $std): float
{
    $u1 = max(mt_rand() / mt_getrandmax(), 1e-12);
    $u2 = mt_rand() / mt_getrandmax();
    $z0 = sqrt(-2.0 * log($u1)) * cos(2.0 * M_PI * $u2);
    return $mean + $z0 * $std;
}
