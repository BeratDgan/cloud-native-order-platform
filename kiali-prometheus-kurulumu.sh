kubectl apply -f "$ISTIO_HOME/samples/addons/prometheus.yaml"
kubectl apply -f "$ISTIO_HOME/samples/addons/kiali.yaml"

kubectl rollout status deployment/prometheus -n istio-system
kubectl rollout status deployment/kiali -n istio-system