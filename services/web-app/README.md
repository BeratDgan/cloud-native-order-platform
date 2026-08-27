# Web App

Sipariş Masası, order-service ile aynı origin üzerinden konuşan bağımsız bir Node.js web servisidir. Framework veya harici runtime bağımlılığı kullanmaz.

Yerelde üç terminal aç:

```bash
PORT=8081 npm --prefix services/user-service start
```

```bash
PORT=8080 USER_SERVICE_URL=http://127.0.0.1:8081 npm --prefix services/order-service start
```

```bash
PORT=3000 ORDER_SERVICE_URL=http://127.0.0.1:8080 npm --prefix services/web-app start
```

Ardından `http://127.0.0.1:3000` adresini aç.
