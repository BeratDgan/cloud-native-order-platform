# AKS taşıması — doğrulama kontrol noktası

Doğrulama tarihi: 10 Eylül 2026. AKS taşıması, Prometheus metrik toplama, Grafana
dashboard, Alertmanager e-posta testi ve Loki tabanlı merkezi loglama tamamlandı.

## Çalışan ortam

- Cluster: `aks-cloud-native-lab`, Sweden Central, Kubernetes `1.35.7`.
- Tek worker: `Standard_D4as_v5`; bu bir HA/üretim kurulumu değildir.
- Ağ: Azure CNI Overlay + Cilium. Minikube cluster'ları ve eski veriler değiştirilmedi.
- Uygulamalar: web-app, user-service, order-service v1/v2, PostgreSQL StatefulSet.
- PostgreSQL: yeni `orders` veritabanı; `managed-csi`, 1 GiB RWO PVC.
- Azure kimliği: image pull için kubelet/AcrPull; Key Vault için ESO + Workload Identity.
- ArgoCD ve Istio gateway servisleri ClusterIP. Yeni public endpoint açılmadı.

AKS Free tier yalnızca control plane fiyatlandırmasıyla ilgilidir. VM, disk, registry,
storage ve ağ kaynaklarının maliyeti ayrı olabilir. AKS'yi durdurmak diskleri silmez.

## Yönetim sınırları ve yeniden kurulum sırası

Terraform Azure kaynaklarını; Helm platform controller'larını; ArgoCD uygulama,
secret, trafik ve policy manifestlerini yönetir. ArgoCD Application/AppProject
tanımları başlangıçta elle uygulanır; henüz bir app-of-apps kurulumu yoktur.

| Helm release | Chart sürümü | Namespace |
| --- | --- | --- |
| argocd | argo-cd 10.8.4 | argocd |
| istio-base / istiod / istio-ingressgateway | 1.30.3 | istio-system |
| external-secrets | 2.10.0 | external-secrets |
| kyverno | 3.9.0 (uygulama 1.19.0) | kyverno |
| monitoring | kube-prometheus-stack 88.6.2 | monitoring |
| loki | loki 18.12.1 (uygulama 3.7.7) | monitoring |
| alloy | alloy 1.12.1 (uygulama 1.19.2) | monitoring |

ArgoCD ve Kyverno override'ları `platform/` altındadır. Gateway kurulumunda
`service.type=ClusterIP`, `labels.istio=ingressgateway`, `autoscaling.enabled=false`,
`replicaCount=1` kullanılmıştır. Istio base için `defaultRevision=default`, ESO için
`installCRDs=true` seçilmiştir; istiod diğer chart varsayılanlarını kullanır.

Yeni cluster'da sıralama:

1. Terraform ile AKS/kimlikler; sonra yukarıdaki sürümlerle platform Helm release'leri.
2. ArgoCD GitHub read-only deploy key bağlantısı; anahtar Git'e konulmaz.
3. `manifests/namespace.yaml`, `labs/kyverno/namespace.yaml`, `argocd/aks-project.yaml`.
4. `external-secrets-config` Application; SecretStore ve ExternalSecret Ready beklenir.
5. `postgresql` Application; pod hazır ve PVC Bound olduktan sonra devam edilir.
6. user-service, order-service ve web-app Application'ları.
7. `aks-platform` ve `aks-kyverno-policy` Application'ları; aşağıdaki testler.
8. kube-prometheus-stack, Loki ve Alloy Helm release'leri; ardından
   `aks-observability` Application'ı.

Application dosyaları `argocd/aks-applications/` altındadır ve `main`i izler.
Mevcut Minikube Application ve values dosyaları korunmuştur. AKS farkları
`values-aks.yaml` ile uygulanır. CI hem varsayılan hem AKS Helm değerlerini lint/render eder.

İlk kurulumda backend PostgreSQL hazır olmadan başlatıldığı için iki order-service
pod'u üçer kez yeniden başladı (`getaddrinfo ENOTFOUND postgresql`). Headless Service
hazır endpoint yayımlayınca backend'ler düzeldi. Yukarıdaki sıralama bu başlangıç
yarışını önler; restart sayısını gizlemek için pod'lar ayrıca silinmedi.

## Trafik ve güvenlik

- Gateway `/` yolunu web-app'e, `/orders` yolunu order-service v1/v2'ye 80/20 yönlendirir.
- Web-app `/api` isteklerini order-service'e proxy eder. Ayrı mesh VirtualService'i
  bu cluster-içi trafiğe de 80/20 uygular; sadece gateway kuralı bunun için yeterli değildir.
- `demo` namespace'inde STRICT mTLS vardır. Tarayıcıdan localhost'a HTTP erişimi,
  servisler arasındaki mTLS'den farklı bir bağlantı ayağıdır.
- `demo` ingress/egress default-deny. DNS ve istiod bağlantıları, gateway → web/order,
  web → order, order → user/PostgreSQL yolları seçici olarak açılmıştır.
- Prometheus, Istio metric-merge endpoint'ini PodMonitor ile scrape eder. NetworkPolicy
  yalnızca monitoring namespace'indeki Prometheus podundan TCP/15020 erişimini açar.
- Kyverno Deny policy'si yalnızca **kyverno-demo** kapsamındadır, bütün cluster'ı veya
  `demo` namespace'ini koruyor gibi değerlendirilmemelidir. Böylece Istio'nun root
  `istio-init` container'ına geniş bir güvenlik istisnası açılmamıştır.
- Admission kuralı Pod CREATE/UPDATE işlemlerinde etkin `runAsNonRoot=true` ve
  `runAsUser != 0` koşullarını kontrol eder. Container/init/ephemeral listeleri background
  taramasında da değerlendirilir. Doğrudan `pods/ephemeralcontainers` alt-kaynak
  güncellemeleri bu kuralın admission eşleşmesine dahil değildir.
- Kyverno'nun varsayılan raporlama RBAC'ı alt-kaynak get/list/watch sağlamadığı için
  policy eşleşmesi `pods` ile sınırlıdır. Bu, root pod admission testini devre dışı bırakmaz.

## Gerçek test sonuçları

| Test | Gözlem |
| --- | --- |
| Web UI ve backend readiness | HTTP 200, `storage: postgres` |
| Gateway `/orders`, 100 GET | Son test: v1=81, v2=19 |
| Web API `/api/orders`, 100 GET | Son test: v1=83, v2=17 |
| kyverno-demo → user-service TCP/8080 | NetworkPolicy nedeniyle bağlantı kurulamadı |
| Aynı probe'a geçici ağ izni | TCP kuruldu; düz HTTP `Connection reset by peer` ile reddedildi |
| Root pod server-side dry-run | Kyverno admission webhook tarafından reddedildi |
| Non-root probe | Running; UID/GID 65532 |
| PostgreSQL kalıcılığı | Pod UID değişti, PVC aynı kaldı, sipariş ID=1 hâlâ `persisted: true` |

80/20 bir olasılık ağırlığıdır; her 100 istekte tam 80 ve 20 beklenmez.
Kalıcılık testinde yalnızca PostgreSQL pod'u kontrollü yeniden başlatıldı. PVC/disk
silinmedi. Tek replica nedeniyle kısa readiness kesintisi oldu; toparlanınca uçtan uca
test tekrar geçti. Test siparişi `AKS persistence verification` adıyla bırakıldı.
Bu test **backup/restore değildir**; Velero/geri yükleme sonraki aşamadır.

Geçici `aks-security-probe` pod'u ve `temporary-mtls-probe` ağ izni test sonunda
kaldırılır. Root pod dry-run olduğu için cluster'a hiç kaydedilmez. Test için açılan
localhost:18080 port-forward da çalışma sonunda kapatılır.

## Screenshot rehberi

Şifre, private key, Secret YAML/JSON'u veya Terraform state içeriği çekilmemeli.

### 1. ArgoCD: yedi yeşil Application

```bash
kubectl --context aks-cloud-native-lab -n argocd port-forward svc/argocd-server 8080:443
```

`https://localhost:8080` → Applications. Yedi uygulamanın `Synced / Healthy`
olduğu toplu ekranı, ardından `postgresql` uygulamasının StatefulSet/Pod/PVC ağacını çek.
`aks-platform` ağacında NetworkPolicy ve Istio nesneleri ayrıca görülebilir.

### 2. Azure Portal: gerçekten Azure'da çalışan workload ve disk

- Kubernetes services → **aks-cloud-native-lab** → Workloads → namespace `demo`.
- Resource groups → **rg-cloud-native-lab-aks-nodes** →
  **pvc-917445f2-3ce5-41e9-8eb7-1ae570d06fde** diski → Overview.
- AKS → Node pools → `system`: tek node ve VM boyutu. Portal menü isimleri değişebilir.

### 3. Terminal: pod, disk ve secret senkronizasyonu

```bash
kubectl --context aks-cloud-native-lab -n demo get pods,pvc
kubectl --context aks-cloud-native-lab -n demo get secretstore,externalsecret
kubectl --context aks-cloud-native-lab -n argocd get applications
```

### 4. Web arayüzü + gerçek trafik testi

```bash
kubectl --context aks-cloud-native-lab -n istio-system port-forward svc/istio-ingressgateway 18080:80
```

`http://localhost:18080` adresinde test siparişini görüntüle. Başka terminalde repo kökünden:

```bash
node tests/aks/smoke.mjs
```

Bu salt okunur test UI, PostgreSQL readiness ve iki trafik yolunu kontrol eder.
Sonuç tablosu olmayan sade terminal çıktısı screenshot için uygundur.

### 5. Kyverno: policy hazır + root reddi

```bash
kubectl --context aks-cloud-native-lab -n kyverno-demo get namespacedvalidatingpolicy
kubectl --context aks-cloud-native-lab apply --dry-run=server -f tests/aks/root-pod.yaml
```

İkinci komutun **hata vermesi beklenen başarıdır**: root pod reddedilir.
`tests/aks/nonroot-probe.yaml` pozitif test içindir; çalıştırırsan test sonunda sil.
`tests/aks/allow-probe-for-mtls.yaml` geçici bir güvenlik iznidir; screenshot için
gereksiz yere uygulama ve hiçbir zaman GitOps kaynak dizinine taşıma.

### 6. CI kanıtı

GitHub Actions'ta ilgili PR'ın test/build, Trivy ve Helm kontrollerinin yeşil ekranı.
Trafik/güvenlik yapılandırması PR #32 ile main'e alınmıştır.

### 7. Prometheus ve Grafana kanıtı

Prometheus'ta `up{namespace="demo",job="monitoring/application-monitor"}` sorgusu üç
uygulama target'ı için `1` döndürmelidir. Grafana'da `Cloud Native Application Overview`
dashboard'u target health, request rate, HTTP 5xx oranı ve pod restart panellerini gösterir.
Ayrıntılı açıklama için [`observability.md`](observability.md) belgesine bakın.

### 8. Loki merkezi log kanıtı

Grafana → Explore bölümünde datasource olarak `Loki` ve zaman aralığı olarak
`Last 15 minutes` seç. `{namespace="demo", app="order-service"} | json` sorgusunda
farklı podlardan gelen yapılandırılmış kayıtların tek ekranda görüldüğünü kanıtla.
Ayrıntılı kurulum ve doğrulama için
[`centralized-logging.md`](centralized-logging.md) belgesine bakın.

## Sıradaki sınır

Kapasite ölçümü ve HPA/VPA. Ardından backup/restore, felaket senaryosu ve en son
Argo Rollouts bonusu.
