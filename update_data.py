"""매주 한 번 실행해서 data/ 폴더의 실거래·지수 파일을 최신으로 바꿉니다.

    python update_data.py

필요한 키는 같은 폴더의 .env 파일에서 읽습니다 (README 참고).
    DATA_GO_KR_KEY   공공데이터포털 서비스키 (국토부 실거래가)
    REB_API_KEY      한국부동산원 R-ONE 키
    ECOS_KEY         한국은행 ECOS 키 (없으면 금리 카드를 건너뜀)
표준 라이브러리만 사용하므로 따로 설치할 것이 없습니다.
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
import xml.etree.ElementTree as ET
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
LAWD = '11290'  # 서울 성북구 법정동코드
MONTHS_BACK = 13  # 실거래는 이번 달 포함 최근 13개월
REB_FROM = (2023, 1)

# 한국부동산원 R-ONE 통계표 (성북구·서울·전국 행만 사용)
REB_TABLES = [('A_2024_00045', 'sale_idx'), ('A_2024_00050', 'jeonse_idx'),
              ('A_2024_00055', 'wolse_idx'), ('A_2024_00554', 'deals')]
# 한국은행 ECOS: (통계표, 주기, 항목코드, 이름)
ECOS = [('722Y001', 'M', '0101000', 'base_rate'),
        ('121Y006', 'M', 'BECBLA0302', 'mortgage')]
REB_UNSOLD_TABLE = 'T237973129847263'  # 미분양주택현황 (월)

CENTROID = {'길음동': (37.6085, 127.0202), '돈암동': (37.5950, 127.0160), '동선동': (37.5917, 127.0160),
            '동소문동': (37.5890, 127.0090), '보문동': (37.5830, 127.0190), '삼선동': (37.5890, 127.0120),
            '상월곡동': (37.6062, 127.0440), '석관동': (37.6100, 127.0600), '성북동': (37.5970, 126.9950),
            '안암동': (37.5850, 127.0300), '장위동': (37.6160, 127.0503), '정릉동': (37.6130, 127.0050),
            '종암동': (37.6010, 127.0320), '하월곡동': (37.6044, 127.0376)}


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


def get(url, tries=3):
    err = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            return urllib.request.urlopen(req, timeout=60).read().decode('utf8')
        except Exception as e:  # 네트워크 오류는 잠깐 쉬고 재시도
            err = e
            time.sleep(2)
    raise RuntimeError('요청 실패: ' + re.sub(r'(?i)(servicekey|key)=[^&]+', r'\1=***', str(url))[:120] + ' / ' + str(err))


def month_list(start, end):
    y, m = start
    out = []
    while (y, m) <= end:
        out.append('%d%02d' % (y, m))
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def base_dong(d):
    return re.sub(r'\d가$', '', d)


def num(s):
    return int(re.sub(r'[^0-9]', '', s or '') or 0)


def fetch_items(key, path, ym):
    out, page = [], 1
    while True:
        qs = urllib.parse.urlencode({'serviceKey': key, 'LAWD_CD': LAWD, 'DEAL_YMD': ym, 'numOfRows': 1000, 'pageNo': page}, safe='%')
        root = ET.fromstring(get('https://apis.data.go.kr/1613000/%s?%s' % (path, qs)))
        code = root.findtext('.//resultCode')
        if code not in (None, '00', '000'):
            raise RuntimeError('공공데이터포털 오류: %s %s (키 또는 활용신청을 확인하세요)' % (code, root.findtext('.//resultMsg')))
        items = root.findall('.//item')
        out += [{c.tag: (c.text or '').strip() for c in it} for it in items]
        total = int(root.findtext('.//totalCount') or 0)
        if page * 1000 >= total or not items:
            return out
        page += 1


def write_csv(name, header, rows):
    with io.open(os.path.join(DATA, name), 'w', encoding='utf8', newline='') as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def update_deals(key):
    today = date.today()
    y, m = today.year, today.month - (MONTHS_BACK - 1)
    while m < 1:
        y, m = y - 1, m + 12
    months = month_list((y, m), (today.year, today.month))
    trade, rent = [], []
    for ym in months:
        for it in fetch_items(key, 'RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade', ym):
            if it.get('cdealType') or it['umdNm'] == '청량리동':
                continue
            trade.append([it['aptNm'], base_dong(it['umdNm']), it['buildYear'], it['excluUseAr'], it['floor'], num(it['dealAmount']),
                          '%s-%02d-%02d' % (it['dealYear'], int(it['dealMonth']), int(it['dealDay']))])
        for it in fetch_items(key, 'RTMSDataSvcAptRent/getRTMSDataSvcAptRent', ym):
            if it['umdNm'] == '청량리동':
                continue
            rent.append([it['aptNm'], base_dong(it['umdNm']), it['buildYear'], it['excluUseAr'], it['floor'], num(it['deposit']), num(it['monthlyRent']),
                         '%s-%02d-%02d' % (it['dealYear'], int(it['dealMonth']), int(it['dealDay']))])
        print('  실거래', ym, '매매 누계', len(trade), '전월세 누계', len(rent))
    write_csv('trade.csv', ['apt', 'dong', 'built', 'area', 'floor', 'price', 'date'], trade)
    write_csv('rent.csv', ['apt', 'dong', 'built', 'area', 'floor', 'deposit', 'monthly', 'date'], rent)
    return trade, rent


def update_apt_list(trade, rent):
    """새로 거래된 단지를 apt.csv 에 추가합니다 (기존 좌표는 그대로 둠)."""
    path = os.path.join(DATA, 'apt.csv')
    rows = list(csv.DictReader(io.open(path, encoding='utf8'))) if os.path.exists(path) else []
    have = {(r['apt'], r['dong']) for r in rows}
    added = 0
    for r in trade + rent:
        k = (r[0], r[1])
        if k not in have:
            have.add(k)
            la, lo = CENTROID.get(r[1], (37.6, 127.03))
            rows.append({'apt': r[0], 'dong': r[1], 'lat': la, 'lon': lo, 'loc': '동 중심(대략)', 'built': r[2], 'name': ''})
            added += 1
    with io.open(path, 'w', encoding='utf8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['apt', 'dong', 'lat', 'lon', 'loc', 'built', 'name'], restval='')
        w.writeheader()
        w.writerows(rows)
    print('  새 단지 %d곳을 apt.csv 에 추가했습니다. 좌표는 python geocode_apts.py 로 보정하세요.' % added)


def reb_rows(key, table, ym):
    qs = urllib.parse.urlencode({'KEY': key, 'Type': 'json', 'STATBL_ID': table, 'DTACYCLE_CD': 'MM', 'WRTTIME_IDTFR_ID': ym, 'pIndex': 1, 'pSize': 1000})
    d = json.loads(get('https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?' + qs))
    block = d.get('SttsApiTblData')
    return block[1].get('row', []) if block and len(block) > 1 else []


def update_reb(key):
    today = date.today()
    rows = []
    for table, name in REB_TABLES:
        for ym in month_list(REB_FROM, (today.year, today.month)):
            for r in reb_rows(key, table, ym):
                full = r.get('CLS_FULLNM') or ''
                reg = {'전국': '전국', '서울': '서울'}.get(full, '성북구' if full.endswith('성북구') else None)
                if not reg or (name == 'deals' and r['ITM_NM'] != '동(호)수'):
                    continue
                rows.append([ym, name, reg, round(float(r['DTA_VAL']), 2)])
        print('  한국부동산원', name, '누계', len(rows))
    write_csv('reb.csv', ['ym', 'series', 'region', 'val'], rows)
    return rows


def update_macro(env):
    """금리(한국은행 ECOS)와 성북구 미분양(한국부동산원). 못 받는 항목은 건너뜁니다."""
    today = date.today()
    start = '%d%02d' % (today.year - 2, today.month)
    end = '%d%02d' % (today.year, today.month)
    rows = []
    if env.get('ECOS_KEY'):
        for stat, cycle, item, name in ECOS:
            try:
                u = 'https://ecos.bok.or.kr/api/StatisticSearch/%s/json/kr/1/100/%s/%s/%s/%s/%s' % (env['ECOS_KEY'], stat, cycle, start, end, item)
                d = json.loads(get(u))
                got = d.get('StatisticSearch', {}).get('row', [])
                for r in got:
                    rows.append([r['TIME'][:6], name, r['DATA_VALUE']])
                if got:
                    print('  ECOS', name, '완료 (%d개월)' % len(got))
                else:
                    print('  ECOS', name, '자료 없음:', (d.get('RESULT') or {}).get('MESSAGE', '응답 형식이 다릅니다'))
            except Exception as e:
                print('  ECOS', name, '건너뜀:', str(e)[:80])
    else:
        print('  ECOS_KEY 가 없어 금리 카드는 건너뜁니다.')
    if env.get('REB_API_KEY'):
        got = 0
        for ym in month_list((today.year - 2, today.month), (today.year, today.month)):
            try:
                for r in reb_rows(env['REB_API_KEY'], REB_UNSOLD_TABLE, ym):
                    if r.get('CLS_NM') == '성북구' and r.get('ITM_NM') in ('계', '합계', '호수', '미분양'):
                        rows.append([ym, 'unsold', r['DTA_VAL']])
                        got += 1
            except Exception:
                pass
        print('  성북구 미분양', '%d건' % got if got else '자료 없음 (카드를 건너뜁니다)')
    write_csv('macro.csv', ['ym', 'series', 'val'], rows)


def main():
    env = load_env()
    os.makedirs(DATA, exist_ok=True)
    need = [k for k in ('DATA_GO_KR_KEY', 'REB_API_KEY') if not env.get(k)]
    if need:
        sys.exit('.env 에 %s 가 없습니다. README 의 "키 준비" 를 먼저 하세요.' % ', '.join(need))
    print('1/4 국토부 실거래가')
    trade, rent = update_deals(env['DATA_GO_KR_KEY'])
    update_apt_list(trade, rent)
    print('2/4 한국부동산원 지수·거래현황')
    update_reb(env['REB_API_KEY'])
    print('3/4 금리·미분양')
    update_macro(env)
    print('4/4 완료. 이어서 python geocode_apts.py 를 실행하면 새 단지 좌표를 보정합니다.')


if __name__ == '__main__':
    main()
