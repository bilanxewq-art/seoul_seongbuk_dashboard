"""카카오 로컬 API로 단지 좌표를 보정합니다.

    python geocode_apts.py          # "동 중심(대략)" 인 단지만 다시 찾기
    python geocode_apts.py --all    # 모든 단지를 다시 찾기

.env 의 KAKAO_REST_KEY 를 읽습니다. 결과는 data/geocode_cache.json 에 저장되어
다시 실행해도 이미 찾은 단지는 호출하지 않습니다. 못 찾은 단지는 화면 위치도에서 숨기고
data/geocode_failed.txt 에 목록을 남깁니다.
"""
import csv
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
CACHE = os.path.join(DATA, 'geocode_cache.json')
FAILED = os.path.join(DATA, 'geocode_failed.txt')
FIELDS = ['apt', 'dong', 'lat', 'lon', 'loc', 'built', 'name']
BOX = (37.575, 37.635, 126.985, 127.075)  # 성북구 대략 범위: 남, 북, 서, 동
JIBUN_ONLY = re.compile(r'^\(?\s*\d+(-\d+)?\s*\)?$')


def load_env():
    env = dict(os.environ)
    path = os.path.join(HERE, '.env')
    if os.path.exists(path):
        for line in io.open(path, encoding='utf8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env


def kakao(key, path, **params):
    url = 'https://dapi.kakao.com/v2/local/search/%s.json?%s' % (path, urllib.parse.urlencode(params))
    req = urllib.request.Request(url, headers={'Authorization': 'KakaoAK ' + key})
    try:
        data = json.loads(urllib.request.urlopen(req, timeout=30).read().decode('utf8'))
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            sys.exit('카카오 REST 키가 거절되었습니다 (%d). .env 의 KAKAO_REST_KEY 와 "카카오맵" 사용 설정을 확인하세요.' % e.code)
        raise
    time.sleep(0.06)
    return data.get('documents', [])


def inside(lat, lon):
    return BOX[0] <= lat <= BOX[1] and BOX[2] <= lon <= BOX[3]


def pick(docs):
    for d in docs:
        lat, lon = float(d['y']), float(d['x'])
        addr = d.get('address_name', '') + d.get('road_address_name', '')
        if '성북구' in addr and inside(lat, lon):
            return d
    return None


def find_named(key, apt, dong):
    """단지명으로 키워드 검색. 아파트·주거시설 분류를 우선한다."""
    clean = re.sub(r'\(.*?\)', '', apt).strip() or apt
    for q in ('성북구 %s %s' % (dong, clean), '성북구 %s' % clean, '%s %s' % (clean, '아파트')):
        docs = kakao(key, 'keyword', query=q, x='127.03', y='37.60', radius=8000)
        good = [d for d in docs if '아파트' in d.get('category_name', '') or '주거' in d.get('category_name', '')]
        hit = pick(good) or pick(docs)
        if hit:
            return {'lat': float(hit['y']), 'lon': float(hit['x']), 'name': '', 'via': 'keyword:' + q, 'place': hit.get('place_name', '')}
    return None


def find_jibun(key, apt, dong):
    """(160-16) 처럼 지번만 있는 이름: 주소 검색 → 근처 아파트 이름을 찾는다."""
    jibun = re.sub(r'[()\s]', '', apt)
    docs = kakao(key, 'address', query='서울 성북구 %s %s' % (dong, jibun))
    hit = pick([{'y': d['y'], 'x': d['x'], 'address_name': (d.get('address') or {}).get('address_name', '') or d.get('address_name', ''),
                 'road_address_name': (d.get('road_address') or {}).get('address_name', ''),
                 'bld': (d.get('road_address') or {}).get('building_name', '')} for d in docs])
    if not hit:
        return None
    lat, lon = float(hit['y']), float(hit['x'])
    name = ''
    for d in docs:
        name = (d.get('road_address') or {}).get('building_name', '') or name
    if not name:
        near = kakao(key, 'keyword', query='아파트', x=str(lon), y=str(lat), radius=120, sort='distance')
        for d in near:
            if '아파트' in d.get('category_name', ''):
                name = d.get('place_name', '')
                break
    if not name:
        return None  # 실제 단지명을 못 찾으면 목록에서 숨김
    return {'lat': lat, 'lon': lon, 'name': name, 'via': 'address+name'}


def main():
    env = load_env()
    key = env.get('KAKAO_REST_KEY')
    if not key:
        sys.exit('.env 에 KAKAO_REST_KEY 가 없습니다. README 의 "키 준비" 를 먼저 하세요.')
    redo_all = '--all' in sys.argv
    cache = json.load(io.open(CACHE, encoding='utf8')) if os.path.exists(CACHE) else {}
    path = os.path.join(DATA, 'apt.csv')
    rows = list(csv.DictReader(io.open(path, encoding='utf8')))
    failed = []
    for r in rows:
        k = r['apt'] + '|' + r['dong']
        if r['loc'] == '정확' and not redo_all and k not in cache:
            continue
        if k not in cache:
            try:
                res = find_jibun(key, r['apt'], r['dong']) if JIBUN_ONLY.match(r['apt']) else find_named(key, r['apt'], r['dong'])
            except Exception as e:
                print('  오류', k, str(e)[:60])
                continue
            cache[k] = res or {'fail': True}
            print('  ', 'OK  ' if res else '못찾음', k, (res or {}).get('name', ''))
        c = cache[k]
        if c.get('fail'):
            failed.append(k)
            if JIBUN_ONLY.match(r['apt']):
                r['loc'] = '숨김'  # 지번만 있고 단지명을 못 찾은 경우
            continue
        r['lat'], r['lon'], r['loc'] = round(c['lat'], 6), round(c['lon'], 6), '정확'
        r['name'] = c.get('name', '')
    with io.open(CACHE, 'w', encoding='utf8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=1, sort_keys=True)
    with io.open(path, 'w', encoding='utf8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, restval='')
        w.writeheader()
        w.writerows(rows)
    with io.open(FAILED, 'w', encoding='utf8') as f:
        f.write('\n'.join(failed) + ('\n' if failed else ''))
    hidden = [r['apt'] + '|' + r['dong'] for r in rows if r['loc'] == '숨김']
    print('\n정확한 좌표: %d곳 / 못 찾음: %d곳 (그중 목록에서 숨김 %d곳)' % (sum(1 for r in rows if r['loc'] == '정확'), len(failed), len(hidden)))
    for k in failed:
        print('  못 찾은 단지:', k, '(숨김)' if k in hidden else '(동 중심 근처에 표시)')
    print('목록은 data/geocode_failed.txt 에도 저장했습니다.')


if __name__ == '__main__':
    main()
