#!/usr/bin/env python3
"""ZIP을 새 임시 폴더에 풀고 실제 로컬 HTTP 제공까지 확인하는 표준 라이브러리 테스트."""
from __future__ import annotations
import os
from pathlib import Path
import sys
import tempfile
import threading
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
zip_path = Path(sys.argv[1]) if len(sys.argv) > 1 else root.parent / 'ALEPH_BR_B_v1.0.0.zip'
with tempfile.TemporaryDirectory(prefix='aleph-br-b-smoke-') as temp:
    with ZipFile(zip_path) as archive:
        if any(i.flag_bits & 1 for i in archive.infolist()):
            raise AssertionError('암호화된 ZIP은 제출할 수 없습니다')
        archive.extractall(temp)
    app = Path(temp) / root.name
    expected = ['index.html','style.css','data.js','app.js','README.md','tests/verify.mjs','tests/interactions.mjs']
    for name in expected:
        assert (app/name).is_file(), f'누락 파일: {name}'
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args,directory=str(app),**kwargs)
        def log_message(self, *_args):
            return
    server=ThreadingHTTPServer(('127.0.0.1',0), Handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        for item in ['','index.html','style.css','data.js','app.js']:
            address=f'http://127.0.0.1:{server.server_port}/{item}'
            with urllib.request.urlopen(address,timeout=3) as res:
                raw=res.read()
                assert res.status == 200, (item,res.status)
                assert len(raw) > 100, (item, len(raw))
                print('PASS HTTP',item or '/', '200', len(raw), 'bytes')
    finally:
        server.shutdown()
    print('PASS ZIP: clean fresh-folder extraction, 7 key files, no password')
