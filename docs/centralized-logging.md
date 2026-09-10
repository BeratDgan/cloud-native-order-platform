# AKS merkezi loglama — Loki ve Grafana Alloy

Bu katman, `demo` namespace'indeki pod loglarını merkezi ve sorgulanabilir hale
getirir. Tek node ve 4 vCPU kotasına sahip laboratuvar cluster'ında EFK yerine daha
az kaynak tüketen Loki'nin monolithic kurulumu ve Grafana Alloy kullanılır.

## Mimari

```text
demo pod stdout/stderr
        │
        │ Kubernetes API (pods/log)
        ▼
Grafana Alloy DaemonSet
        │  Loki push API
        ▼
Loki single binary ── 5 GiB managed-csi PVC
        │
        ▼
Grafana Explore / LogQL
```

Alloy host dosya sistemini veya container runtime dizinlerini mount etmez. Yalnızca
`demo` namespace'i için verilen `pods` ve `pods/log` okuma yetkileriyle Kubernetes
API üzerinden logları takip eder. Bu nedenle cluster genelinde gereksiz bir
ClusterRole kullanılmaz.

## Bileşenler ve sorumlulukları

| Bileşen | Sorumluluk | AKS ayarı |
| --- | --- | --- |
| Grafana Alloy | Pod keşfi, etiketleme ve Loki'ye gönderim | DaemonSet, non-root, namespace-scoped RBAC |
| Loki | Logları indeksleme, saklama ve LogQL sorguları | Monolithic, tek replica, filesystem |
| Azure Disk PVC | Loki verisinin pod yeniden oluşunca korunması | `managed-csi`, 5 GiB, RWO |
| Grafana | Loki sorgularının çalıştırıldığı arayüz | Loki datasource otomatik provision edilir |

Her kayıt `cluster`, `namespace`, `pod`, `container`, `app` ve `job` etiketleriyle
zenginleştirilir. Böylece tek bir uygulama, pod veya container hızlıca filtrelenir.

## Neden bu topoloji?

Loki'nin dağıtık kurulumu yatay ölçek ve yüksek erişilebilirlik içindir; bu proje ise
tek worker'lı ve kaynak kotası sınırlı bir öğrenme ortamıdır. Bu yüzden tek binary ve
tek replica bilinçli bir tercihtir. Cache, gateway, canary ve ayrı read/write/backend
bileşenleri kapalıdır.

Log saklama süresi 72 saattir. PVC'nin Helm kaynağı silinse bile korunması istenir,
ancak bu disk **backup değildir**. Node bölgesi veya disk kaybına karşı koruma Velero
ve ayrı felaket kurtarma aşamasında ele alınmalıdır.

## Kurulum ve yeniden kurulum

Helm değerleri Git'te aşağıdaki dosyalarda tutulur:

- [`platform/loki/values-aks.yaml`](../platform/loki/values-aks.yaml)
- [`platform/alloy/values-aks.yaml`](../platform/alloy/values-aks.yaml)
- [`platform/monitoring/values-aks.yaml`](../platform/monitoring/values-aks.yaml)

Kullanılan chart sürümleri sabitlenmiştir:

```bash
helm upgrade --install loki grafana-community/loki \
  --version 18.12.1 --namespace monitoring \
  --values platform/loki/values-aks.yaml

helm upgrade --install alloy grafana/alloy \
  --version 1.12.1 --namespace monitoring \
  --values platform/alloy/values-aks.yaml

helm upgrade monitoring prometheus-community/kube-prometheus-stack \
  --version 88.6.2 --namespace monitoring \
  --values platform/monitoring/values-aks.yaml
```

İlk iki komut log deposunu ve toplayıcıyı kurar. Son komut yeni monitoring stack'i
kurmaz; mevcut release'e Loki datasource tanımını ekler.

## Doğrulama

```bash
kubectl --context aks-cloud-native-lab -n monitoring get pods \
  -l app.kubernetes.io/instance=alloy

kubectl --context aks-cloud-native-lab -n monitoring get pods,pvc \
  -l app.kubernetes.io/instance=loki

helm --kube-context aks-cloud-native-lab -n monitoring list
```

Beklenen durum Alloy için `2/2 Running`, Loki için `1/1 Running`, Loki PVC'si için
`Bound` ve üç Helm release'i için `deployed` durumudur.

Grafana'ya erişmek için:

```bash
kubectl --context aks-cloud-native-lab -n monitoring \
  port-forward svc/monitoring-grafana 3001:80
```

`http://localhost:3001` → **Explore** → datasource olarak **Loki** seçilir. Yararlı
LogQL sorguları:

```logql
{namespace="demo"}
{namespace="demo", app="order-service"} | json
{namespace="demo", container="user-service"} | json | level="error"
```

İkinci sorgu merkezi ve yapılandırılmış backend loglarını göstermek için en iyi kanıt
ekranıdır. Üstte zaman aralığı `Last 15 minutes`, sağ üstte `Live` kapalı ve sonuçlarda
`service`, `event`, `status`, `durationMs` alanları görünür olmalıdır. Secret, e-posta
adresi veya Grafana giriş bilgisi ekran görüntüsüne dahil edilmemelidir.

## Sınırlar

- Tek Loki replica nedeniyle pod yeniden başlarken kısa sorgu kesintisi olabilir.
- Filesystem storage ve tek Azure Disk, yüksek erişilebilir üretim tasarımı değildir.
- Yalnızca `demo` namespace logları toplanır; platform namespace'leri bilinçli olarak
  kapsam dışındadır.
- İlk Alloy açılışında çalışan podların çok eski log satırları Loki kabul penceresinin
  dışında kalabilir. Yeni loglar normal biçimde alınmaya devam eder.
