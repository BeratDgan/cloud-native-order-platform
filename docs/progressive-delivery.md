# Argo Rollouts, Istio canary ve otomatik rollback

AKS ortamında web-app artık standart Deployment yerine Argo `Rollout` kaynağıyla
yönetilir. Minikube varsayılan values dosyasında bu özellik kapalıdır; orada mevcut
Deployment davranışı devam eder.

## Trafik akışı

```text
Istio Gateway
     │
     ▼
platform-ingress VirtualService
     ├── 100/80/50% ──► web-app-stable Service ──► stable ReplicaSet
     └──   0/20/50% ──► web-app-canary Service ──► canary ReplicaSet
                                      │
                                      ▼
                              Prometheus 5xx analizi
```

Yeni image tag'i Git'e geldiğinde Rollouts controller şu adımları yürütür:

1. Canary pod'u açar ve Istio ağırlığını `%20` yapar.
2. 30 saniye bekler.
3. Prometheus'tan son bir dakikanın web-app 5xx oranını üç kez ölçer.
4. Oran `%5` veya altındaysa `%50` trafiğe çıkar, 30 saniye daha bekler ve `%100`
   promotion yapar.
5. Eşik aşılırsa AnalysisRun başarısız olur; rollout `Degraded/Aborted` durumuna
   geçer ve Istio trafiği stable ReplicaSet'e geri döndürür.

Rollouts controller stable/canary Service selector'larını ve VirtualService
ağırlıklarını kendisi yönetir. `aks-platform` Application bu iki weight alanını
`ignoreDifferences` ile dışarıda bırakır; böylece ArgoCD self-heal ile Rollouts
controller birbiriyle kavga etmez.

HPA `scaleTargetRef` doğrudan Rollout kaynağını hedefler. VPA hâlâ `Off` modundadır;
yalnızca öneri üretir. Tek node ve 50 pod sınırı nedeniyle controller tek replica,
dashboard kapalıdır.

## Kontrollü rollback testi

Web-app'te yalnızca bu laboratuvar için opt-in bir endpoint vardır. Normal durumda
`/rollout-test/fail` HTTP 200 döner. `webApp.rollout.simulateFailure=true` ile oluşan
yeni canary revision aynı endpoint'te HTTP 503 döner. Test süresince gateway'e bu
yoldan trafik gönderildiğinde Prometheus ölçümü `%5` eşiğini aşar ve otomatik abort
kanıtlanır. Final Git durumunda değer tekrar `false` olmalıdır.

İzlemek için:

```bash
kubectl --context aks-cloud-native-lab -n demo get \
  rollout,analysisrun,replicaset,pod

kubectl --context aks-cloud-native-lab -n demo describe rollout web-app

kubectl --context aks-cloud-native-lab -n demo get virtualservice \
  platform-ingress -o jsonpath='{.spec.http[1].route[*].weight}'
```

## Screenshot rehberi

1. `46-argo-rollouts-canary.png`: ArgoCD web-app resource tree içinde Rollout,
   stable/canary ReplicaSet, iki Service ve AnalysisRun birlikte.
2. `47-istio-canary-weights.png`: terminalde Rollout `Progressing/Paused` ve
   VirtualService ağırlıkları `80 20` veya `50 50`.
3. `48-automatic-rollback.png`: başarısız AnalysisRun, Rollout `Degraded/Aborted`
   ve ağırlıkların `100 0` olduğu aynı ekran.
