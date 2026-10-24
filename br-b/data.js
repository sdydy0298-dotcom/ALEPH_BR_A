/**
 * ALEPH T10 paper-derived aggregate values only (not the upstream raw dataset).
 * Rows: each mean summarizes 10 DNSperf 10-second sessions, not individual DNS requests.
 * Provenance: https://github.com/ranya-pch/DNS-performance/blob/155b567530af0a9b3d496e613cf671f40792a67a/data/dnsperf_trials_all.csv
 * Selection: meta_protocol=DoT; meta_proxy=haproxy; meta_server_cores=64;
 * TTL metadata 1 or 3600; threads/clients in 8/8, 16/16, 32/128.
 * TTL metadata was NOT independently verified as applied server configuration.
 * No cache HIT/MISS information is present. No causal claims are justified.
 */
window.DNS_RESEARCH = Object.freeze({
  paper: "공개 DNSperf 자료의 TTL 기록값별 DNS-over-TLS 응답 성능 비교",
  date: "2026-10-15",
  sourceCommit: "155b567530af0a9b3d496e613cf671f40792a67a",
  originalRows: 300,
  selectedSessions: 60,
  perGroup: 10,
  conditions: ["8/8", "16/16", "32/128"],
  rows: [
    {load: "8/8",   ttl: 1,    n: 10, latency: 0.2958, qps: 292892},
    {load: "8/8",   ttl: 3600, n: 10, latency: 0.3001, qps: 290004},
    {load: "16/16", ttl: 1,    n: 10, latency: 0.2987, qps: 285824},
    {load: "16/16", ttl: 3600, n: 10, latency: 0.3080, qps: 278769},
    {load: "32/128",ttl: 1,    n: 10, latency: 0.5482, qps: 159597},
    {load: "32/128",ttl: 3600, n: 10, latency: 0.5526, qps: 159572}
  ]
});
