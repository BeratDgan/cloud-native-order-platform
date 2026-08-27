export ISTIO_HOME="$PWD/istio-1.30.3"
export PATH="$ISTIO_HOME/bin:$PATH"

minikube start --driver=docker --cpus=4 --memory=16384

istioctl install \
  --set profile=demo \
  --set values.global.platform=minikube \
  -y

kubectl apply -f manifests/namespace.yaml

docker build -t user-service:demo services/user-service
docker build --build-arg APP_VERSION=v1 \
  -t order-service:v1 services/order-service
docker build --build-arg APP_VERSION=v2 \
  -t order-service:v2 services/order-service

minikube image load user-service:demo
minikube image load order-service:v1
minikube image load order-service:v2

helm upgrade --install user-service \
  ./helm/user-service \
  --namespace demo

helm upgrade --install order-service \
  ./helm/order-service \
  --namespace demo

kubectl rollout status deployment/user-service -n demo
kubectl rollout status deployment/order-service-v1 -n demo
kubectl rollout status deployment/order-service-v2 -n demo

kubectl apply -f istio/
istioctl analyze -n demo

kubectl apply -f \
  "$ISTIO_HOME/samples/addons/prometheus.yaml"

kubectl apply -f \
  "$ISTIO_HOME/samples/addons/kiali.yaml"

kubectl rollout status deployment/prometheus -n istio-system
kubectl rollout status deployment/kiali -n istio-system