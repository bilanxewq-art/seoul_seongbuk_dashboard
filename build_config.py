"""KAKAO_JS_KEY 를 .env 에서 읽어 config.js 에 써 줍니다 (GitHub Pages 에 올라가는 파일).

    python build_config.py

카카오 JavaScript 키는 화면에 그대로 드러나는 키라서 올려도 되지만, 카카오 개발자 콘솔의
"플랫폼 > Web" 에 등록한 주소에서만 동작합니다. REST 키와 다른 키는 이 파일에 쓰지 않습니다.
"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def read_env():
    env = {}
    path = os.path.join(HERE, '.env')
    if os.path.exists(path):
        for line in io.open(path, encoding='utf8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


key = read_env().get('KAKAO_JS_KEY', '')
if not key:
    sys.exit('.env 에 KAKAO_JS_KEY 가 없습니다. 키 없이도 화면은 약식 위치도로 동작합니다.')
if "'" in key or '"' in key or '\\' in key or '\n' in key:
    sys.exit('KAKAO_JS_KEY 값에 따옴표나 역슬래시가 있습니다. .env 를 확인하세요.')
with io.open(os.path.join(HERE, 'config.js'), 'w', encoding='utf8') as f:
    f.write("/* build_config.py 가 만든 파일입니다. 카카오 JavaScript 키만 들어 있습니다. */\n"
            "window.APP_CONFIG = { kakaoJsKey: '%s' };\n" % key)
print('config.js 를 만들었습니다. (키 길이 %d자)' % len(key))
