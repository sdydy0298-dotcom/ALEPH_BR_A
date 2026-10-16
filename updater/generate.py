#!/usr/bin/env python3
"""Offline deterministic BR-A updater. Python 3 standard library only."""
import argparse
import hashlib
import json
import re
from pathlib import Path

GROUPS = {
  "자기조절력": ("끝까지", "포기", "계획", "집중", "우선순위", "마무리", "복습"),
  "대인관계력": ("도움", "알려", "함께", "같이", "경청", "설명", "공유", "대화"),
  "자기동기력": ("도전", "새로운", "시도", "찾아", "검색", "공부", "이해", "흥미"),
}
def stable(data):
    return (json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':'))+'\n').encode('utf-8')
def read(path, default):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default
def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(stable(data))
def run():
    ap=argparse.ArgumentParser()
    ap.add_argument('--input',default='input')
    ap.add_argument('--output',default='output')
    args=ap.parse_args()
    inp=Path(args.input); out=Path(args.output)
    ritual=read(inp/'ritual_public_safe.json',{'days':[]})
    attendance=read(inp/'attendance.json',{})
    tasks=read(inp/'tasks.json',{})
    approvals=read(inp/'approvals.json',{'approved':[]})
    days=sorted(ritual['days'], key=lambda d:d['date'])
    if len({d['date'] for d in days})!=len(days):raise ValueError('duplicate dates')
    if any(not re.fullmatch(r'\d{4}-\d{2}-\d{2}',d['date']) for d in days):raise ValueError('invalid date')
    candidates=[]
    for day in days:
        for field in ('own_action','own_episode'):
            sentence=day.get(field,'').strip()
            if not sentence:continue
            group=next((g for g,words in GROUPS.items() if any(word in sentence for word in words)),None)
            if group is None:continue
            ident=hashlib.sha256((day['date']+field+sentence).encode()).hexdigest()[:12]
            candidates.append({'id':ident,'date':day['date'],'category':group,'source':'리추얼 기록 / '+field,'evidence':sentence,'suggestion':day['date']+'에 '+sentence})
    candidates.sort(key=lambda c:(c['date'],c['id']))
    summary={'as_of':days[-1]['date'] if days else None,'ritual_days':len(days),'open_records':sum(bool(d.get('open_recorded')) for d in days),'close_entries':sum(bool(d.get('close_recorded')) for d in days),'attendance':attendance,'tasks':tasks,'candidate_count':len(candidates),'source':'내 리추얼 기록 / 내 출석 기록 / 내 제출 현황'}
    approved=[x for x in candidates if x['id'] in set(approvals.get('approved',[]))]
    result={'summary':summary,'approved_paragraphs':approved,'publication_requires_review':True}
    input_hash=hashlib.sha256(stable({'ritual':ritual,'attendance':attendance,'tasks':tasks,'approvals':approvals})).hexdigest()
    output_hash=hashlib.sha256(stable(result)).hexdigest()
    write(out/'candidates.json',{'candidates':candidates,'approval_instruction':'검토 후 승인한 id만 input/approvals.json에 추가합니다.'})
    write(out/'public_snapshot.json',result)
    write(out/'verification.json',{'input_sha256':input_hash,'output_sha256':output_hash,'candidate_count':len(candidates),'approved_count':len(approved)})
    print('BR-A SUCCESS '+output_hash)
if __name__=='__main__':run()
