(function () {
  'use strict';
  const data = window.DNS_RESEARCH;
  const fmt = new Intl.NumberFormat('ko-KR');
  const state = { load: 'all', metric: 'latency' };
  const $ = (id) => document.getElementById(id);

  const group = (load) => data.rows.filter((row) => load === 'all' || row.load === load);
  const pair = (load) => data.rows.filter((row) => row.load === load);
  const metricText = (value, metric) => metric === 'latency' ? value.toFixed(4) : fmt.format(value);
  const unit = (metric) => metric === 'latency' ? 'ms' : 'QPS';
  function compareRows(rows, key) {
    const a = rows.find((row) => row.ttl === 1);
    const b = rows.find((row) => row.ttl === 3600);
    return a && b ? b[key] - a[key] : null;
  }
  function safeText(node, text) {
    node.textContent = String(text);
  }
  function make(tag, className, label) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label !== undefined) safeText(node, label);
    return node;
  }
  function setPress(groupId, attr, val) {
    $(groupId).querySelectorAll('button').forEach((btn) => {
      const active = btn.dataset[attr] === val;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function renderChart() {
    const rows = group(state.load);
    const key = state.metric;
    const maximum = key === 'latency' ? 0.65 : 330000;
    safeText($('chart-title'), key === 'latency' ? '부하별 평균 응답시간' : '부하별 평균 처리량 (QPS)');
    safeText($('chart-desc'), key === 'latency'
      ? '단위는 밀리초(ms)이며 낮은 값이 빠른 응답을 뜻합니다. 이 비교만으로 TTL의 효과를 판단할 수 없습니다.'
      : '초당 처리 질의 수(QPS)이며 높은 값은 이 측정 환경에서의 높은 처리량을 뜻합니다.');
    safeText($('chart-unit'), '단위: ' + unit(key));
    const host = $('chart');
    host.replaceChildren();
    const candidates = state.load === 'all' ? data.conditions : [state.load];
    for (const label of candidates) {
      const two = rows.filter((x) => x.load === label);
      const block = make('div', 'bar-group');
      const labelBox = make('div', 'bar-group-label');
      labelBox.append(make('strong', '', label), make('span', '', 'T / C'));
      const bars = make('div', 'bar-group-bars');
      for (const row of two) {
        const line = make('div', 'bar-line');
        const tag = make('span', 'bar-label', row.ttl === 1 ? 'TTL 1s' : 'TTL 3600s');
        const track = make('div', 'bar-track');
        const fill = make('span', 'bar-fill ' + (row.ttl === 1 ? 'violet' : 'pink'));
        fill.style.width = Math.max(0, Math.min(100, row[key] / maximum * 100)).toFixed(3) + '%';
        track.append(fill);
        const number = make('strong', 'bar-value', metricText(row[key], key));
        line.append(tag, track, number);
        bars.append(line);
      }
      const diff = compareRows(two, key);
      const diffLabel = make('p', 'bar-delta', '기록값 차이 (3600 − 1): ' + (diff >= 0 ? '+' : '') + metricText(diff, key) + ' ' + unit(key));
      bars.append(diffLabel);
      block.append(labelBox, bars);
      host.append(block);
    }
    const axis = make('div', 'axis');
    const spacer = make('span', 'axis-spacer', '');
    const ticks = make('div', 'axis-ticks');
    for (let i = 0; i <= 4; i++) ticks.append(make('span', '', metricText(maximum * i / 4, key)));
    axis.append(spacer, ticks, make('span', 'axis-end', ''));
    host.append(axis);
    host.setAttribute('aria-label', candidates.map((c) => {
      const [a,b] = pair(c);
      return `${c}: TTL 1초 ${metricText(a[key],key)} ${unit(key)}, TTL 3600초 ${metricText(b[key],key)} ${unit(key)}`;
    }).join('; '));
  }

  function renderSummary() {
    const current = group(state.load);
    const diffs = (state.load === 'all' ? data.conditions : [state.load])
      .map((v) => compareRows(pair(v), state.metric));
    const smallest = Math.min(...diffs);
    const largest = Math.max(...diffs);
    const value = $('delta-value');
    value.replaceChildren();
    const label = state.load === 'all'
      ? (state.metric === 'latency' ? `${smallest.toFixed(4)} ~ ${largest.toFixed(4)}` : `${fmt.format(smallest)} ~ ${fmt.format(largest)}`)
      : `${smallest >= 0 ? '+' : ''}${metricText(smallest, state.metric)}`;
    value.append(document.createTextNode(label + ' '), make('small', '', unit(state.metric)));
    safeText($('selected-load'), state.load === 'all' ? '전체 부하 비교' : state.load + ' 부하');
    safeText($('selected-count'), `${current.length}개 그룹 · ${current.reduce((n, x) => n + x.n, 0)}개 세션`);
    safeText($('delta-caption'), state.metric === 'latency'
      ? 'TTL 3600초 − 1초 · ' + (state.load === 'all' ? '3개 부하' : state.load + ' 부하')
      : 'QPS 기준 · TTL 3600초 − 1초');
  }

  function renderTable() {
    const tbody = $('data-body');
    tbody.replaceChildren();
    const rows = group(state.load);
    for (const row of rows) {
      const tr = make('tr');
      const load = make('td', 'weight-cell', row.load);
      const ttl = make('td');
      ttl.append(make('span', 'ttl-pill ' + (row.ttl === 1 ? 'ttl-violet' : 'ttl-pink'), fmt.format(row.ttl) + '초'));
      tr.append(load, ttl, make('td', '', row.n + '회'), make('td', 'num-cell', row.latency.toFixed(4) + ' ms'), make('td', 'num-cell', fmt.format(row.qps) + ' QPS'));
      tbody.append(tr);
    }
    safeText($('table-count'), rows.length + ' ROWS');
  }

  function renderInterpretation() {
    if (state.load === 'all') {
      safeText($('interpret-title'), '부하가 증가한 조건에서 지연은 길고 QPS는 낮게 관찰됐습니다.');
      safeText($('interpret-text'), '8/8에서 32/128로 바뀐 두 조건 레이블 모두 평균 응답시간이 약 0.25ms 길었고, 평균 QPS는 약 45% 낮았습니다. 스레드와 클라이언트가 함께 바뀌므로 원인을 분리할 수 없습니다.');
    } else {
      const [a, b] = pair(state.load);
      const d = b.latency - a.latency;
      const dq = b.qps - a.qps;
      safeText($('interpret-title'), `${state.load} 부하의 두 TTL 기록 그룹은 근접한 지연시간을 보였습니다.`);
      safeText($('interpret-text'), `TTL 1초 ${a.latency.toFixed(4)}ms, 3,600초 ${b.latency.toFixed(4)}ms로, 3,600초 기록 그룹 평균이 ${d.toFixed(4)}ms 길었습니다. QPS 차이는 ${fmt.format(dq)}로 관찰됐습니다. 하지만 통계적으로 안정적인 차이는 확인되지 않았고, TTL의 실제 적용도 검증되지 않았습니다.`);
    }
  }
  function render() {
    renderChart(); renderSummary(); renderTable(); renderInterpretation();
  }

  function download(filename, mime, contents) {
    const blob = new Blob(['\ufeff', contents], {type:mime + ';charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor = make('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    safeText($('download-feedback'), filename + ' 파일 다운로드를 요청했습니다.');
  }
  function csvContent(rows) {
    const first = 'load_t_c,ttl_metadata_s,sessions,mean_latency_ms,mean_qps';
    const entries = rows.map((x) => [x.load,x.ttl,x.n,x.latency.toFixed(4),x.qps].join(','));
    return [first,...entries].join('\r\n') + '\r\n';
  }
  function reportContent() {
    const rows = group(state.load);
    const selected = state.load === 'all' ? '전체 3개 부하' : state.load;
    const selectedMetric = state.metric === 'latency' ? '평균 응답시간(ms)' : '평균 처리량(QPS)';
    const table = rows.map((r) => `${r.load.padEnd(7)} | ${String(r.ttl).padEnd(4)} | ${String(r.n).padEnd(2)} | ${r.latency.toFixed(4)}ms | ${fmt.format(r.qps)} QPS`).join('\r\n');
    const explanation = state.load === 'all'
      ? '세 부하 모두 TTL 3600초 기록 그룹의 평균 지연시간은 1초 기록 그룹보다 0.0043~0.0093ms 길었습니다.'
      : (() => {
          const [a, b] = pair(state.load);
          return `${state.load} 부하에서 TTL 1초 기록 그룹은 ${a.latency.toFixed(4)}ms, 3600초 기록 그룹은 ${b.latency.toFixed(4)}ms로 차이는 ${(b.latency-a.latency).toFixed(4)}ms였습니다.`;
        })();
    return `DNS BENCHMARK INSIGHT — T10 연구 기반 분석 요약\r\n` +
      `=====================================================\r\n`+
      `연구 제목: ${data.paper}\r\n`+
      `대상: 공개 DNSperf 60개 10초 측정 세션의 2차 분석\r\n`+
      `현재 선택: 부하 ${selected} / 지표 ${selectedMetric}\r\n`+
      `고정 조건: DoT · HAProxy · 64 cores\r\n\r\n`+
      `부하(T/C) | TTL(초) | n  | 평균 응답시간 | 평균 QPS\r\n${table}\r\n\r\n`+
      `해석: ${explanation}\r\n`+
      `그러나 탐색적 Welch 검정 Holm 보정 p값이 3개 부하 모두 0.05 이상이므로 유의한 차이를 확인하지 못했습니다.\r\n\r\n`+
      `[반드시 지킬 연구 한계]\r\n`+
      `- TTL은 기록용 메타데이터로, 실제 서버 적용 여부를 독립적으로 검증하지 못했습니다.\r\n`+
      `- 캐시 HIT/MISS가 측정되지 않았으므로 DNS 캐시의 성능 효과를 뜻하지 않습니다.\r\n`+
      `- 스레드와 클라이언트 수가 함께 변경되고 실험 순서도 무작위가 아니었습니다.\r\n`+
      `- 원저자의 공개 데이터를 재분석했으며 직접 실험한 측정이 아닙니다.\r\n\r\n`+
      `원본 고정 커밋: https://github.com/ranya-pch/DNS-performance/blob/${data.sourceCommit}/data/dnsperf_trials_all.csv\r\n`+
      `버전: v1.0.0 / BR-B\r\n`;
  }
  function convertLatency(raw) {
    const val = raw.trim();
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(val)) return {error:'숫자만 입력해 주세요. 예: 0.2958'};
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0 || num > 60000) return {error:'0 이상 60,000 이하의 값을 입력해 주세요.'};
    return {ms:num, us:num*1000, seconds:num/1000};
  }
  function nice(value, max = 9) {
    return Number(value.toFixed(max)).toLocaleString('ko-KR', {maximumFractionDigits:max});
  }
  function handleConvert(e) {
    e.preventDefault();
    const result = convertLatency($('latency-input').value);
    const input = $('latency-input');
    if (result.error) {
      safeText($('converter-error'), result.error);
      $('converter-result').classList.add('invalid');
      input.setAttribute('aria-invalid','true');
      return;
    }
    input.removeAttribute('aria-invalid');
    safeText($('converter-error'), '');
    $('converter-result').classList.remove('invalid');
    safeText($('result-us'), nice(result.us, 6));
    safeText($('result-sec'), nice(result.seconds, 9));
  }
  function init() {
    if (!data || !Array.isArray(data.rows) || data.rows.length !== 6) {
      safeText($('data-body'), '연구 요약값을 확인할 수 없습니다. 전체 파일을 같은 폴더에 두고 다시 열어 주세요.');
      return;
    }
    $('load-controls').addEventListener('click',(e) => {
      const b = e.target.closest('button[data-load]');
      if (!b || !$('load-controls').contains(b)) return;
      const val = b.dataset.load;
      if (val !== 'all' && !data.conditions.includes(val)) return;
      state.load = val; setPress('load-controls', 'load', state.load); render();
    });
    $('metric-controls').addEventListener('click',(e) => {
      const b = e.target.closest('button[data-metric]');
      if (!b || !$('metric-controls').contains(b)) return;
      if (!['latency','qps'].includes(b.dataset.metric)) return;
      state.metric = b.dataset.metric; setPress('metric-controls','metric',state.metric); render();
    });
    $('download-csv').addEventListener('click', () => download('DNS_Insight_T10_summary.csv', 'text/csv', csvContent(group(state.load))));
    $('download-report').addEventListener('click', () => download('DNS_Insight_T10_report.txt', 'text/plain', reportContent()));
    $('reset-filters').addEventListener('click', () => {
      state.load = 'all'; state.metric = 'latency';
      setPress('load-controls','load','all'); setPress('metric-controls','metric','latency');
      render(); safeText($('download-feedback'), '전체 부하와 평균 응답시간 지표로 되돌렸습니다.');
      $('explorer').scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start'});
    });
    $('converter-form').addEventListener('submit',handleConvert);
    render();
    window.DNS_INSIGHT_TEST = Object.freeze({convertLatency, csvContent, reportContent, state});
  }
  document.addEventListener('DOMContentLoaded', init);
})();
