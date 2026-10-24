/** DOM 이벤트 기반 회귀 점검: 별도 NPM 패키지 없이 Node.js vm에서 실제 app.js 실행 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const nodes = new Map();
const createdUrls = new Map();
let index = 0;
const events = new Map();
class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
    this.style = {}; this.attrs = {}; this.textContent = ''; this.value = '';
    this.listeners = {}; this.parentNode = null;
    const classes = new Set();
    this.classList = {
      add: (...items) => items.forEach(v=>classes.add(v)),
      remove: (...items) => items.forEach(v=>classes.delete(v)),
      contains: (v) => classes.has(v),
      toggle: (v,on) => {if (on === false) classes.delete(v); else if(on || !classes.has(v)) classes.add(v); else classes.delete(v);},
    };
  }
  append(...kids) { for(const kid of kids) { this.children.push(kid); kid.parentNode = this;} }
  replaceChildren(...kids) {this.children = []; this.textContent = ''; this.append(...kids)}
  setAttribute(k,v) {this.attrs[k] = String(v)}
  getAttribute(k) {return this.attrs[k] ?? null}
  removeAttribute(k) {delete this.attrs[k]}
  addEventListener(name, cb) {this.listeners[name]=cb}
  contains(node) {return this === node || this.children.some(c=>c.contains?.(node))}
  closest(selector) {
    if(selector === 'button[data-load]' && this.tagName === 'BUTTON' && 'load' in this.dataset) return this;
    if(selector === 'button[data-metric]' && this.tagName === 'BUTTON' && 'metric' in this.dataset) return this;
    return null;
  }
  querySelectorAll(selector) {return selector==='button'?this.children.filter(c=>c.tagName==='BUTTON'):[]}
  scrollIntoView() {this.scrolled = true}
  click() {if(this.download)createdUrls.set('latestDownload',this);this.listeners.click?.({target:this})}
  remove() {if (this.parentNode) this.parentNode.children=this.parentNode.children.filter(x=>x!==this)}
}
for(const id of ['chart','chart-title','chart-desc','chart-unit','data-body','table-count','delta-value','selected-load','selected-count','delta-caption','interpret-title','interpret-text','load-controls','metric-controls','download-csv','download-report','reset-filters','converter-form','latency-input','converter-error','converter-result','result-us','result-sec','download-feedback','explorer'])nodes.set(id,new Element());
for(const val of ['all','8/8','16/16','32/128']){let b=new Element('button');b.dataset.load=val;nodes.get('load-controls').append(b)}
for(const val of ['latency','qps']){let b=new Element('button');b.dataset.metric=val;nodes.get('metric-controls').append(b)}
const document = {
  getElementById: id => nodes.get(id) ?? null,
  createElement: tag => new Element(tag),
  createTextNode: value => {let a=new Element('#text');a.textContent=String(value);return a},
  addEventListener: (name,fn)=>events.set(name,fn),
  body: new Element('body'),
};
const window = {matchMedia:()=>({matches:false})};
const URLmock={createObjectURL: blob => {const url='blob:'+ ++index;createdUrls.set(url,blob);return url},revokeObjectURL() {}};
vm.runInNewContext(data,{window}, {filename:'data.js'});
vm.runInNewContext(app, {window,document,Intl,Blob,URL:URLmock,setTimeout(){},Number,console}, {filename:'app.js'});
events.get('DOMContentLoaded')();
const get=id=>nodes.get(id);
const press=(type,val)=>{
 const root=get(type+'-controls');
 const b=root.children.find(x=>x.dataset[type]===val);
 root.listeners.click({target:b});
};
let n=0;const pass=(label,fn)=>{fn();console.log('OK '+(++n)+': '+label)};
pass('초기 렌더링 표 6행',()=>assert.equal(get('data-body').children.length,6));
pass('초기 그래프 3개 부하',()=>assert.equal(get('chart').children.filter(x=>x.className==='bar-group').length,3));
pass('초기 세션 60개',()=>assert.ok(get('selected-count').textContent.includes('60개 세션')));
press('load','16/16');
pass('16/16 선택으로 표 2행',()=>assert.equal(get('data-body').children.length,2));
pass('현재 부하 및 세션 20개 갱신',()=>{assert.equal(get('selected-load').textContent,'16/16 부하');assert.ok(get('selected-count').textContent.includes('20개 세션'))});
pass('지연 결과 보고 내용 갱신',()=>assert.ok(get('interpret-text').textContent.includes('0.2987ms')));
press('metric','qps');
pass('QPS 그래프 제목 변경',()=>assert.equal(get('chart-title').textContent,'부하별 평균 처리량 (QPS)'));
pass('QPS 그룹차 -7,055 표시',()=>assert.ok(get('delta-value').children[0].textContent.includes('-7,055')));
get('download-csv').click();
pass('CSV 다운로드 이벤트',()=>assert.equal(createdUrls.get('latestDownload').download,'DNS_Insight_T10_summary.csv'));
const csv=await createdUrls.get(createdUrls.get('latestDownload').href).text();
pass('다운로드 CSV에는 선택한 2개 행만 포함',()=>assert.equal(csv.trim().split(/\r?\n/).length,3));
get('download-report').click();
const report=await createdUrls.get(createdUrls.get('latestDownload').href).text();
pass('보고서에 선택 부하 16/16·지표 QPS 기록',()=>{assert.ok(report.includes('16/16'));assert.ok(report.includes('평균 처리량(QPS)'))});
get('latency-input').value='abc';get('converter-form').listeners.submit({preventDefault(){}});
pass('잘못된 입력은 오류 및 aria-invalid',()=>{assert.ok(get('converter-error').textContent.includes('숫자'));assert.equal(get('latency-input').attrs['aria-invalid'],'true')});
get('latency-input').value='0.2958';get('converter-form').listeners.submit({preventDefault(){}});
pass('정상 입력은 295.8 마이크로초',()=>{assert.equal(get('result-us').textContent,'295.8');assert.ok(!get('latency-input').attrs['aria-invalid'])});
pass('음수/범위 초과 오류',()=>{for(const v of ['-1','60001','NaN','1e3',' '])assert.ok(window.DNS_INSIGHT_TEST.convertLatency(v).error)});
get('reset-filters').click();
pass('초기화 시 전체 6행 복구',()=>assert.equal(get('data-body').children.length,6));
pass('초기화 시 지연 측정 그래프로 복귀',()=>assert.equal(get('chart-title').textContent,'부하별 평균 응답시간'));
console.log(`PASS: ${n}/${n} 앱 이벤트 로직 테스트 완료`);
