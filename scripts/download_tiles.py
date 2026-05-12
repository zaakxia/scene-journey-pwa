"""Download CartoDB Light tiles for self-hosted world map.
Parallel download with connection pooling.
CartoDB Positron/Light: grayscale+bright pastel, ~7KB/tile.

Usage:
  python scripts/download_tiles.py            # full download
  python scripts/download_tiles.py --dry-run  # count only
  python scripts/download_tiles.py --phase 1  # zoom 0-8 only
  python scripts/download_tiles.py --phase 2  # zoom 9-10 only
  python scripts/download_tiles.py --phase 3  # city detail only
"""
import os, sys, time, math
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import socks, socket

# Route through v2rayN SOCKS5 proxy (10808) for tile downloads
socks.set_default_proxy(socks.SOCKS5, '127.0.0.1', 10808)
socket.socket = socks.socksocket

# Also set up suyou HTTP proxy (7897) as git push proxy hint
# Git: use -c http.proxy=http://127.0.0.1:7897 for faster pushes

TILE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'tiles')
# CartoDB Light — inherently monochrome/pastel, ~7KB/tile
TILE_URL = 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
USER_AGENT = 'scene-journey-tile-downloader/1.0'
WORKERS = 6
DELAY_PER_WORKER = 0.15  # seconds between requests per thread
MAX_RETRIES = 2
DRY_RUN = '--dry-run' in sys.argv

def lat_lng_to_tile(lat, lng, z):
    n = 2 ** z
    x = int((lng + 180.0) / 360.0 * n)
    y = int((1.0 - math.log(math.tan(math.radians(lat)) + 1.0 / math.cos(math.radians(lat))) / math.pi) / 2.0 * n)
    return x, y

def download_one(z, x, y):
    """Download single tile, return 'skip'|'ok'|'empty'|'fail'"""
    tile_path = os.path.join(TILE_DIR, str(z), str(x), f'{y}.png')
    if os.path.exists(tile_path):
        return 'skip'
    if DRY_RUN:
        return 'would'

    os.makedirs(os.path.dirname(tile_path), exist_ok=True)
    url = TILE_URL.format(z=z, x=x, y=y)
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            data = urllib.request.urlopen(req, timeout=15).read()
            with open(tile_path, 'wb') as f: f.write(data)
            return 'empty' if len(data) < 200 else 'ok'
        except:
            if attempt < MAX_RETRIES - 1: time.sleep(2)
    return 'fail'

def download_range(z, x_min, x_max, y_min, y_max):
    """Download a rectangular tile range at zoom z using parallel workers."""
    n = 2 ** z
    x_min = max(0, x_min); x_max = min(n-1, x_max)
    y_min = max(0, y_min); y_max = min(n-1, y_max)
    tiles = [(z, x, y) for x in range(x_min, x_max+1) for y in range(y_min, y_max+1)]

    total = len(tiles)
    stats = {'ok': 0, 'skip': 0, 'empty': 0, 'fail': 0}
    done = 0
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {}
        # Submit initial batch
        submit_count = 0
        for t in tiles:
            futures[pool.submit(download_one, *t)] = t
            submit_count += 1

        for fut in as_completed(futures):
            result = fut.result()
            stats[result] = stats.get(result, 0) + 1
            done += 1
            if done % 500 == 0:
                elapsed = time.time() - t0
                rate = done / elapsed if elapsed > 0 else 0
                print(f'  z{z}: {done}/{total} ({done*100//total}%) speed={rate:.0f} t/s')

    return stats

def download_whole_world_zoom(z):
    """Download EVERY tile at zoom z (entire planet)."""
    n = 2 ** z
    t0 = time.time()
    print(f'\n--- World zoom {z}: {n}x{n} = {n*n:,} tiles ---')
    stats = download_range(z, 0, n-1, 0, n-1)
    elapsed = time.time() - t0
    new_mb = stats['ok'] * 7 / 1024
    print(f'  ok={stats["ok"]} skip={stats["skip"]} empty={stats["empty"]} fail={stats["fail"]} (~{new_mb:.1f}MB new) in {elapsed/60:.1f}min')
    return stats

def download_bbox(z_min, z_max, min_lat, min_lng, max_lat, max_lng, label):
    """Download all tiles for a geographic bounding box across zoom levels."""
    print(f'\n--- {label} zoom {z_min}-{z_max} ---')
    total = {'ok':0,'skip':0,'empty':0,'fail':0}
    for z in range(z_min, z_max + 1):
        x_min, y_max = lat_lng_to_tile(min_lat, min_lng, z)
        x_max, y_min = lat_lng_to_tile(max_lat, max_lng, z)
        if y_min > y_max: y_min, y_max = y_max, y_min
        s = download_range(z, x_min, x_max, y_min, y_max)
        for k in total: total[k] += s[k]
        mb = s['ok'] * 7 / 1024
        print(f'  z{z}: ok={s["ok"]} skip={s["skip"]} ~{mb:.1f}MB')
    return total

def main():
    phase = None
    for a in sys.argv:
        if a.startswith('--phase='):
            phase = int(a.split('=')[1])

    mode = '(DRY RUN - no download)' if DRY_RUN else '(DOWNLOADING)'
    print(f'Tile dir:  {TILE_DIR}')
    print(f'Tile src:  {TILE_URL}')
    print(f'Workers:   {WORKERS}  Delay: {DELAY_PER_WORKER}s')
    print(f'Mode:      {mode}')
    print()

    # Build tile lists for estimation
    need_phase = lambda p: phase is None or phase == p
    grand = {'ok':0,'skip':0,'empty':0,'fail':0}

    if need_phase(1):
        print('=' * 60)
        print('PHASE 1: World base map (zoom 0-8)')
        print(f'Total world tiles z0-8: {sum(4**z for z in range(9)):,}')
        print(f'Estimated size: ~{sum(4**z for z in range(9))*7/1024:.0f}MB')
        print('=' * 60)
        for z in range(0, 9):
            s = download_whole_world_zoom(z)
            for k in grand: grand[k] += s[k]

    if need_phase(2):
        print('\n' + '=' * 60)
        print('PHASE 2: Major countries (zoom 9-10)')
        print('Estimated: ~95K tiles, ~651MB')
        print('=' * 60)
        regions = [
            (31.0, 130.0, 42.0, 146.0, 'Japan'),           # 2,360 tiles ~16MB
            (18.0, 73.0, 54.0, 135.0, 'China'),            # 29,436 tiles ~201MB
            (33.0, 124.0, 39.0, 132.0, 'Korea'),           # 672 tiles ~5MB
            (25.0, -125.0, 49.0, -66.0, 'USA'),            # 18,697 tiles ~128MB
            (35.0, -10.0, 60.0, 30.0, 'Europe'),           # 15,725 tiles ~108MB
            (-8.0, 95.0, 22.0, 140.0, 'Southeast Asia'),   # 14,277 tiles ~98MB
            (-39.0, 113.0, -10.0, 155.0, 'Australia'),     # 14,027 tiles ~96MB
        ]
        for r in regions:
            s = download_bbox(9, 10, *r)
            for k in grand: grand[k] += s[k]
            print(f'  {r[4]}: ok={s["ok"]} skip={s["skip"]}')

    if need_phase(3):
        print('\n' + '=' * 60)
        print('PHASE 3: Scene cities (zoom 10-15)')
        print('Estimated: ~15K tiles, ~105MB')
        print('=' * 60)
        cities = [
            # Japan (primary 圣地巡礼)
            (10, 15, 35.35, 139.40, 35.95, 140.65, 'Tokyo'),
            (10, 15, 33.60, 132.48, 34.05, 132.95, 'Matsuyama'),
            (10, 15, 34.40, 135.00, 34.95, 135.95, 'Nara-Kobe'),
            # China
            (10, 15, 39.70, 116.10, 40.20, 116.70, 'Beijing'),
            (10, 15, 31.70, 117.10, 32.00, 117.50, 'Hefei'),
            (10, 15, 30.50, 109.30, 31.40, 111.40, 'Fengjie-YC'),
            (10, 15, 29.40, 101.70, 29.80, 102.20, 'Hailuogou'),
            # International
            (10, 15, 41.60, -88.00, 42.20, -87.35, 'Chicago'),
            (10, 15, 51.40, -0.30, 51.60, 0.15, 'London'),
            (10, 14, 44.20, 9.05, 44.45, 9.40, 'Portofino'),
        ]
        for c in cities:
            s = download_bbox(c[0], c[1], *c[2:])
            for k in grand: grand[k] += s[k]
            print(f'  {c[6]}: ok={s["ok"]} skip={s["skip"]}')

    print('\n' + '=' * 60)
    print('ALL PHASES COMPLETE')
    total_new = grand['ok'] + grand['empty']
    print(f'New tiles: {total_new:,} (~{total_new*7/1024:.0f}MB)')
    print(f'Skipped:   {grand["skip"]:,}')
    print(f'Failed:    {grand["fail"]}')
    print('=' * 60)

if __name__ == '__main__':
    main()
