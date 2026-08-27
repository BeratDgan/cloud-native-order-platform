kubectl -n istio-system port-forward \
  service/istio-ingressgateway \
  8080:80