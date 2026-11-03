# 만수부동산 성북구 대시보드

성북구 아파트 실거래가(국토교통부), 한국부동산원 가격지수, 카카오맵 위치도를 한 화면에 보여 주는 중개 상담용 대시보드입니다.
서버 없이 파일만으로 동작하는 정적 사이트라서 GitHub Pages에 그대로 올릴 수 있습니다.

## 폴더 구성

| 파일 | 하는 일 |
|---|---|
| `index.html`, `styles.css`, `app.js`, `dash-shim.js` | 화면과 동작 |
| `config.js` | 카카오 JavaScript 키가 들어가는 파일 |
| `data/*.csv` | 화면에 쓰이는 데이터 (실거래, 지수, 단지 위치, 주변 시설 등) |
| `update_data.py` | 실거래·지수·금리를 새로 받아 `data/`를 갱신 |
| `geocode_apts.py` | 카카오 검색으로 단지 좌표를 정확하게 보정 |
| `build_config.py` | `.env`의 카카오 JavaScript 키를 `config.js`에 써 줌 |
| `.env` | **비밀 키 보관 파일 (GitHub에 올라가지 않음)** |

## 1. 처음 한 번만: 키 준비

1. `.env.example` 파일을 복사해서 이름을 `.env`로 바꿉니다.
2. 메모장으로 열어 `=` 뒤에 키를 붙여 넣고 저장합니다. 따옴표는 붙이지 않습니다.

| 이름 | 어디서 받나요 | 꼭 필요한가요 |
|---|---|---|
| `DATA_GO_KR_KEY` | 공공데이터포털(data.go.kr) 마이페이지 > 일반 인증키 | 예 |
| `REB_API_KEY` | 한국부동산원 R-ONE(reb.or.kr/r-one) 오픈API 인증키 | 예 |
| `KAKAO_REST_KEY` | 카카오 개발자(developers.kakao.com) > 내 애플리케이션 > 앱 키 > REST API 키 | 좌표 보정할 때 |
| `KAKAO_JS_KEY` | 같은 곳의 JavaScript 키 | 카카오맵을 쓸 때 |
| `ECOS_KEY` | 한국은행 ECOS(ecos.bok.or.kr) 인증키 | 아니요 (없으면 금리 카드가 숨겨짐) |

> **주의:** `.env`와 REST 키, 공공데이터 키는 절대 채팅·이메일·코드에 붙여 넣지 마세요.
> GitHub에 올라가는 파일에는 카카오 **JavaScript 키**만 들어갑니다.

카카오 JavaScript 키는 카카오 개발자 콘솔의 **플랫폼 > Web 사이트 도메인**에 아래 주소를 등록해야 지도가 나옵니다.

```text
http://localhost:8080
https://bilanxewq-art.github.io
```

그다음 아래 명령으로 `config.js`를 만듭니다.

```bash
python build_config.py
```

## 2. 매주 갱신하는 방법

파이썬(3.9 이상)만 있으면 되고 따로 설치할 것은 없습니다. 이 폴더에서 터미널(PowerShell)을 열고 순서대로 입력하세요.

1. **데이터 새로 받기** (1~3분 걸립니다)

   ```bash
   python update_data.py
   ```

   `data/trade.csv`(매매), `rent.csv`(전월세), `reb.csv`(부동산원 지수), `macro.csv`(금리·미분양)가 새로 만들어집니다.
   새로 거래된 단지는 `apt.csv`에 "동 중심(대략)" 위치로 추가됩니다.

2. **새 단지 좌표 보정** (새 단지가 있을 때만 의미가 있고, 이미 찾은 단지는 다시 호출하지 않습니다)

   ```bash
   python geocode_apts.py
   ```

   못 찾은 단지 목록이 화면에 나오고 `data/geocode_failed.txt`에도 저장됩니다.
   `(160-16)`처럼 지번만 있는 단지는 실제 이름을 못 찾으면 화면 목록에서 숨겨집니다.

3. **내 컴퓨터에서 확인**

   ```bash
   python -m http.server 8080
   ```

   브라우저에서 <http://localhost:8080> 을 엽니다. 확인이 끝나면 터미널에서 `Ctrl + C`로 끕니다.
   (`index.html`을 더블클릭하면 데이터를 못 읽습니다. 꼭 위 주소로 여세요.)

4. **GitHub에 올리기**

   ```bash
   git add data index.html app.js styles.css dash-shim.js config.js
   git commit -m "weekly data update"
   git push
   ```

   올린 뒤 1~2분 지나면 GitHub Pages 주소에 반영됩니다.

### 자주 막히는 곳

- `.env 에 ... 가 없습니다` → `.env` 파일 이름과 `=` 뒤 값을 확인하세요.
- `공공데이터포털 오류` → 키가 맞는지, 그리고 "아파트 매매 실거래가"와 "아파트 전월세 실거래가" 활용 신청이 승인됐는지 확인하세요.
- 지도가 약식 위치도로만 보임 → `config.js`에 키가 있는지, 카카오 콘솔에 접속 주소가 등록됐는지 확인하세요.
- 최근 달 거래 건수가 적음 → 실거래 신고가 계약 후 최대 30일까지 늦어져서 정상입니다.

## 3. 직접 고치는 곳

- **중개사무소 표시:** `index.html` 아래쪽 `<footer>`에서 `class="blank"`로 비워 둔 칸(대표 공인중개사, 등록번호, 소재지)에 실제 값을 적고, 전화번호도 실제 번호로 바꿉니다.
- **추천매물:** `data/listing.csv`를 엑셀이나 메모장으로 고칩니다. 현재 4건은 예시입니다.
- **개발·규제 안내 문구:** `data/dev.csv`를 고칩니다. 현재 문구는 일반 개요이므로 구청·서울시 공고로 확인한 뒤 사용하세요.

## 데이터 출처

국토교통부 아파트 매매·전월세 실거래가(공공데이터포털), 한국부동산원 R-ONE, 한국은행 ECOS, 카카오 지도/로컬, OpenStreetMap(지하철·학교·상권 위치).
