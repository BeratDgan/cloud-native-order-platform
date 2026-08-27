for i in $(seq 1 100); do
  curl -s http://127.0.0.1:8080/orders/$i
  echo
done | grep -o '"version":"v[12]"' | sort | uniq -c