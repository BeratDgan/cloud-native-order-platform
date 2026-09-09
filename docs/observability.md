# AKS Observability

Bu aşamada uygulama metrikleri Prometheus tarafından toplanır, Grafana dashboard'u
GitOps ile provision edilir ve temel uygulama alarmları PrometheusRule olarak yönetilir.
Merkezi loglama ve Alertmanager'ın harici bildirim kanalına bağlanması sonraki adımdır.

## Veri akışı

```text
user-service / order-service
        │  /metrics
        ▼
Istio metric merge :15020/stats/prometheus
        │
        ▼
PodMonitor → Prometheus → Grafana
                    │
                    └── PrometheusRule → Alertmanager
```

Uygulamalar kendi `http_requests_total` ve `http_request_duration_seconds_*`
metriklerini üretir. Istio injection sırasında uygulamanın Prometheus annotation'ları
metric-merge endpoint'ine yönlendirilir. `application-monitor` PodMonitor'ı `demo`
namespace'indeki `user-service` ve `order-service` podlarını seçerek bu endpoint'i
30 saniyede bir scrape eder.

PodMonitor port keşfini pod metadata'sından yaptığı için iki uygulama Deployment'ı
`15020` portunu `istio-metrics` adıyla ilan eder. Bu, uygulamanın 15020 üzerinde yeni
bir sunucu başlattığı anlamına gelmez; pod içindeki ortak ağ alanında Istio agent bu
portu dinler. NetworkPolicy yalnızca `monitoring` namespace'indeki Prometheus podundan
bu porta erişime izin verir.

## Grafana dashboard

`Cloud Native Application Overview` dashboard'u aşağıdaki panelleri içerir:

| Panel | Kaynak | Amaç |
| --- | --- | --- |
| Service Target Health | `up` | Üç uygulama target'ının scrape durumunu gösterir |
| Application Request Rate | `http_requests_total` | Health/metrics dışındaki kullanıcı trafiğinin saniyelik hızını gösterir |
| HTTP 5xx Error Rate | `http_requests_total` | Son beş dakikadaki 5xx yüzdesini gösterir |
| Pod Restart Count | `kube_pod_container_status_restarts_total` | `demo` workload restart sayılarını gösterir |

Dashboard, `grafana_dashboard: "1"` etiketli bir ConfigMap olarak Git'te tutulur.
Grafana sidecar bu ConfigMap'i izler ve dashboard'u otomatik olarak provision eder.
Sabit UID kullanıldığı için yeniden kurulumda yeni bir dashboard kopyası oluşmaz.

## Alarm kuralları

`application-alerts` PrometheusRule üç koşulu değerlendirir:

| Alarm | Koşul | Bekleme | Seviye |
| --- | --- | --- | --- |
| `ApplicationTargetDown` | Uygulama target'ı `up == 0` | 2 dakika | critical |
| `HighHttp5xxRate` | Beş dakikalık 5xx oranı `%5` üzerinde | 2 dakika | warning |
| `DemoPodRestarted` | Son 10 dakikada restart artışı | yok | warning |

`release: monitoring` etiketi, kube-prometheus-stack tarafından yönetilen Prometheus
instance'ının bu kuralı seçmesini sağlar. Alarm üretimi ile bildirim gönderimi farklı
aşamalardır: Prometheus koşulu değerlendirir, Alertmanager ise eşleşen alarmı seçilen
harici alıcıya yönlendirir.

## GitOps kaynakları

- [`pod-monitor.yaml`](../gitops/aks-observability/pod-monitor.yaml)
- [`network-policy.yaml`](../gitops/aks-observability/network-policy.yaml)
- [`grafana-dashboard.yaml`](../gitops/aks-observability/grafana-dashboard.yaml)
- [`application-alerts.yaml`](../gitops/aks-observability/application-alerts.yaml)

ArgoCD `gitops/aks-observability` dizinini izler. `main` değiştiğinde yeni dashboard,
alarm kuralları ve scrape ayarları cluster'a otomatik olarak uygulanır.

## Doğrulama

```bash
kubectl --context aks-cloud-native-lab -n monitoring get podmonitor application-monitor
kubectl --context aks-cloud-native-lab -n monitoring get prometheusrule application-alerts
kubectl --context aks-cloud-native-lab -n monitoring get configmap grafana-dashboard-application-overview
```

Prometheus'ta kullanılan temel kontrol sorgusu:

```promql
up{namespace="demo",job="monitoring/application-monitor"}
```

Beklenen sonuç order-service v1, order-service v2 ve user-service için üç adet `1`
değeridir.

## Kanıt ekranları

![Monitoring kaynaklarının ArgoCD görünümü](screenshots/36-control-of-monitoring-argoetc.png)

![Prometheus uygulama target'ları](screenshots/37-prometheus-query-for-services.png)

![Grafana uygulama dashboard'u](screenshots/38-grafana-application-dashboard.png)

## Kalan adım

PrometheusRule alarm üretmeye hazırdır. Gerçek dış bildirim için Alertmanager receiver
bilgisi bir Kubernetes Secret üzerinden sağlanmalı; webhook veya SMTP parolası Git'e
yazılmamalıdır. Bundan sonra merkezi loglama için Loki kurulacaktır.
