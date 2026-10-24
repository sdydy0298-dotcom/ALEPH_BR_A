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
    safeText($('chart-title'), key === 'latency' ? '부하별 평균 응답시간' : '부하별 초당 DNS 질의 수 (QPS)');
    safeText($('chart-desc'), key === 'latency'
      ? 'DNS 질의를 보낸 뒤 응답받기까지 걸린 평균 시간입니다. 짧을수록 빠르지만, 이 차이가 TTL 때문인지는 알 수 없습니다.'
      : 'QPS는 1초 동안 처리한 DNS 질의 개수입니다. 높을수록 같은 시험 환경에서 더 많은 요청을 처리했다는 뜻입니다.');
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
      const diffLabel = make('p', 'bar-delta', '두 그룹 평균의 차이 (3600 − 1): ' + (diff >= 0 ? '+' : '') + metricText(diff, key) + ' ' + unit(key));
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
      ? '기록된 TTL 3600초 − 1초 · ' + (state.load === 'all' ? '3개 부하' : state.load + ' 부하')
      : '초당 DNS 질의 수 차이 · TTL 3600초 − 1초');
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
      safeText($('interpret-title'), '부하 조건이 더 큰 그룹에서 응답은 느리고 초당 처리 건수는 적었습니다.');
      safeText($('interpret-text'), '8/8과 32/128 조건을 비교하면 평균 응답시간은 약 0.25ms 더 길었고, 1초 동안 처리한 DNS 질의 수(QPS)는 약 45% 적었습니다. 스레드와 클라이언트 수를 동시에 바꾼 기록이므로 원인을 하나로 꼽을 수는 없습니다.');
    } else {
      const [a, b] = pair(state.load);
      const d = b.latency - a.latency;
      const dq = b.qps - a.qps;
      safeText($('interpret-title'), `${state.load} 조건에서는 두 TTL 그룹의 평균 응답시간이 비슷했습니다.`);
      safeText($('interpret-text'), `TTL 1초로 기록된 그룹은 ${a.latency.toFixed(4)}ms, 3,600초로 기록된 그룹은 ${b.latency.toFixed(4)}ms입니다. 평균 차이는 ${d.toFixed(4)}ms입니다. 1초 동안 처리한 DNS 질의 수(QPS) 차이는 ${fmt.format(dq)}건이었습니다. 하지만 우연한 변동일 수도 있으며, 실제 TTL 설정 여부도 확인하지 못했습니다.`);
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
    const selectedMetric = state.metric === 'latency' ? '평균 응답시간(ms)' : '초당 DNS 질의 수(QPS, 평균 처리량)';
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
      `대상: 다른 연구자가 공개한 DNSperf 10초 시험 기록 60건을 재분석\r\n`+
      `현재 선택: 부하 ${selected} / 지표 ${selectedMetric}\r\n`+
      `고정 조건: DoT · HAProxy · 64 cores\r\n\r\n`+
      `읽는 법: 평균 응답시간(ms)은 짧을수록 빠르고, QPS는 1초 동안 처리한 DNS 질의 수(높을수록 많음)입니다.\r\n`+
      `부하(T/C) | TTL(초) | 시험 횟수 | 평균 응답시간 | 초당 DNS 질의 수(QPS)\r\n${table}\r\n\r\n`+
      `해석: ${explanation}\r\n`+
      `결론: 숫자 차이는 있지만 우연한 변동일 가능성을 배제할 수 없어 어느 TTL이 더 빠르다고 판단할 수 없습니다.\r\n`+
      `상세 근거: Welch 검정 후 Holm 보정한 p값이 세 부하 모두 0.05 이상입니다.\r\n\r\n`+
      `[이 결과를 해석할 때 주의할 점]\r\n`+
      `- TTL 1초와 3600초는 자료에 기록된 분류값입니다. 실제 서버 적용 여부는 확인되지 않았습니다.\r\n`+
      `- 캐시에서 바로 응답했는지(HIT), 새로 조회했는지(MISS) 기록이 없어 캐시의 효과를 알 수 없습니다.\r\n`+
      `- 스레드 수와 클라이언트 수를 함께 바꿔 시험했고, 진행 순서도 무작위가 아니어서 차이의 원인을 구별할 수 없습니다.\r\n`+
      `- 직접 측정한 결과가 아니라 다른 연구자의 공개 시험 기록을 다시 분석한 것입니다.\r\n\r\n`+
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
