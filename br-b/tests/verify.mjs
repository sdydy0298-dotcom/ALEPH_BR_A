import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const css = fs.readFileSync(path.join(root,'style.css'),'utf8');
const dataJs = fs.readFileSync(path.join(root,'data.js'),'utf8');
const appJs = fs.readFileSync(path.join(root,'app.js'),'utf8');
const checks = [];
function check(label,run){run();checks.push(label);}
const sandbox={window:{},document:{addEventListener(){}}};
vm.runInNewContext(dataJs,sandbox,{filename:'data.js'});
const d=sandbox.window.DNS_RESEARCH;
check('실제 연구 6개 조건 집계',()=>assert.equal(d.rows.length,6));
check('선택한 원측정 세션 60개',()=>assert.equal(d.rows.reduce((a,x)=>a+x.n,0),60));
check('논문 부하 3개',()=>assert.deepEqual(Array.from(d.conditions),['8/8','16/16','32/128']));
check('TTL 레이블 1/3600',()=>assert.deepEqual([...new Set(d.rows.map(x=>x.ttl))],[1,3600]));
check('모든 그룹 10회',()=>assert.ok(d.rows.every(x=>x.n===10)));
check('8/8의 지연 데이터 일치',()=>{assert.equal(d.rows[0].latency,0.2958);assert.equal(d.rows[1].latency,0.3001)});
check('16/16의 QPS 데이터 일치',()=>{assert.equal(d.rows[2].qps,285824);assert.equal(d.rows[3].qps,278769)});
check('32/128의 지연 데이터 일치',()=>{assert.equal(d.rows[4].latency,0.5482);assert.equal(d.rows[5].latency,0.5526)});
check('연구 관찰 지연 차이 3개',()=>{
 const differences=Array.from(d.conditions).map(load=>{
  let rows=d.rows.filter(x=>x.load===load);
  return +(rows[1].latency-rows[0].latency).toFixed(4);
 });
 assert.deepEqual(differences,[0.0043,0.0093,0.0044]);
});
check('처리량 차이 3개',()=>{
 let differences=Array.from(d.conditions).map(load=>{
  let rows=d.rows.filter(x=>x.load===load);return rows[1].qps-rows[0].qps;
 });
 assert.deepEqual(differences,[-2888,-7055,-25]);
});
check('기존 연구와 원자료 출처 포함',()=>{assert.ok(html.includes('공개 DNSperf 자료의 TTL 기록값별'));assert.ok(html.includes(d.sourceCommit))});
check('3개 사용자 행동 버튼 존재',()=>{for(const id of ['load-controls','metric-controls','download-report'])assert.ok(html.includes(`id="${id}"`))});
check('필수 파일 상대 경로',()=>{for(const f of ['style.css','data.js','app.js'])assert.ok(html.includes(`./${f}`))});
check('스크립트 Node 구문',()=>new vm.Script(appJs,{filename:'app.js'}));
check('연구의 미확인 요소 명시',()=>{assert.ok(html.includes('HIT')||html.includes('MISS'));assert.ok(html.includes('적용됐는지'))});
check('불필요한 CDN 호출 없음',()=>{assert.ok(!html.includes('cdn.'));assert.ok(!html.includes('fonts.googleapis.com'))});
check('입력 검증 함수 존재',()=>{assert.ok(appJs.includes('convertLatency(raw)'));assert.ok(appJs.includes("숫자만 입력해 주세요"))});
check('TXT CSV 파일 내보내기 함수 존재',()=>{assert.ok(appJs.includes('reportContent()'));assert.ok(appJs.includes('csvContent(rows)'))});
check('비밀번호나 시크릿 문자열 없음',()=>{
 for(const v of [html,css,dataJs,appJs])assert.ok(!/-----BEGIN PRIVATE KEY-----|sk_live_|service_role=|password\s*=\s*['"][^'"]+/i.test(v));
});
check('T10 요약에는 원자료 각 행 저장하지 않음',()=>assert.ok(!dataJs.includes('avg_latency_s,cmd,')));
check('QPS 쉬운 설명을 첫 화면에 제공',()=>{assert.ok(html.includes('1초 동안 처리한 DNS 질의 개수'));assert.ok(html.includes('논문의 통계 검사 방법 보기'))});
console.log(`PASS: ${checks.length}/${checks.length} 정적·계산 로직 테스트 완료`);
checks.forEach((x,i)=>console.log(`${i+1}. ${x}`));
