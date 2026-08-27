const elements = {
  serviceState: document.querySelector("#service-state"),
  serviceStateText: document.querySelector("#service-state-text"),
  storageReadout: document.querySelector("#storage-readout"),
  orderCount: document.querySelector("#order-count"),
  lastVersion: document.querySelector("#last-version"),
  orderForm: document.querySelector("#order-form"),
  formMessage: document.querySelector("#form-message"),
  createOrder: document.querySelector("#create-order"),
  quantity: document.querySelector("#quantity"),
  ordersBody: document.querySelector("#orders-body"),
  refreshOrders: document.querySelector("#refresh-orders"),
  probeForm: document.querySelector("#probe-form"),
  sendProbe: document.querySelector("#send-probe"),
  responseStatus: document.querySelector("#response-status"),
  responseJson: document.querySelector("#response-json code"),
  v1Count: document.querySelector("#v1-count"),
  v2Count: document.querySelector("#v2-count"),
  v1Bar: document.querySelector("#v1-bar"),
  v2Bar: document.querySelector("#v2-bar"),
  resetCounts: document.querySelector("#reset-counts"),
  toast: document.querySelector("#toast")
};

const state = {
  counts: JSON.parse(sessionStorage.getItem("version-counts") || '{"v1":0,"v2":0}'),
  pendingOrderId: null,
  toastTimer: null
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(6000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(body.details) ? ` ${body.details.join(" ")}` : "";
    throw new Error(`${body.message || `HTTP ${response.status}`}${detail}`);
  }
  return { body, response };
}

function setBusy(button, busy, busyLabel) {
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent.trim();
  button.disabled = busy;
  if (button.firstElementChild) {
    button.firstElementChild.textContent = busy ? busyLabel : button.dataset.defaultLabel.replace("→", "").trim();
  } else {
    button.textContent = busy ? busyLabel : button.dataset.defaultLabel;
  }
}

function showToast(message, stateName = "success") {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.dataset.state = stateName;
  elements.toast.hidden = false;
  state.toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 3200);
}

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function createCell(value, className, label) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  if (label) cell.dataset.label = label;
  cell.textContent = value;
  return cell;
}

function createVersionCell(version) {
  const cell = createCell("", "", "Servis");
  const tag = document.createElement("span");
  tag.className = "version-tag";
  tag.textContent = version || "—";
  cell.append(tag);
  return cell;
}

function renderOrders(orders) {
  elements.ordersBody.replaceChildren();
  if (orders.length === 0) {
    const row = document.createElement("tr");
    row.className = "state-row";
    const cell = createCell("Henüz kalıcı demo siparişi yok. Soldaki formdan ilk siparişi oluştur.");
    cell.colSpan = 6;
    row.append(cell);
    elements.ordersBody.append(row);
    return;
  }

  for (const order of orders) {
    const row = document.createElement("tr");
    row.dataset.orderId = order.id;
    if (state.pendingOrderId === order.id) row.classList.add("order-arrival");
    row.append(
      createCell(`#${order.id}`, "order-id", "Sipariş"),
      createCell(order.product, "", "Ürün"),
      createCell(order.user?.name || `Kullanıcı ${order.user?.id || "—"}`, "", "Kullanıcı"),
      createCell(String(order.quantity), "", "Adet"),
      createVersionCell(order.version),
      createCell(formatTime(order.createdAt), "", "Zaman")
    );
    elements.ordersBody.append(row);
  }
}

function renderOrderError(message) {
  elements.ordersBody.replaceChildren();
  const row = document.createElement("tr");
  row.className = "state-row error";
  const cell = createCell(`${message} Servisleri başlatıp kuyruğu yeniden deneyebilirsin.`);
  cell.colSpan = 6;
  row.append(cell);
  elements.ordersBody.append(row);
}

async function checkService() {
  try {
    const { body } = await fetchJson("/api/healthz");
    elements.serviceState.dataset.state = "online";
    elements.serviceStateText.textContent = `order-service ${body.version || ""} çalışıyor`.trim();
    elements.lastVersion.textContent = body.version || "—";
  } catch {
    elements.serviceState.dataset.state = "offline";
    elements.serviceStateText.textContent = "order-service erişilemiyor";
  }
}

async function loadOrders({ announce = false } = {}) {
  elements.refreshOrders.disabled = true;
  try {
    const { body } = await fetchJson("/api/orders");
    renderOrders(body.items || []);
    elements.orderCount.textContent = String(body.count ?? 0);
    elements.storageReadout.textContent = body.storage === "memory" ? "Bellek" : body.storage || "—";
    elements.lastVersion.textContent = body.version || elements.lastVersion.textContent;
    if (state.pendingOrderId) {
      const insertedRow = elements.ordersBody.querySelector(`[data-order-id="${CSS.escape(state.pendingOrderId)}"]`);
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      insertedRow?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      state.pendingOrderId = null;
    }
    if (announce) showToast("Sipariş kuyruğu yenilendi.");
  } catch (error) {
    renderOrderError(error.message);
    elements.orderCount.textContent = "—";
    if (announce) showToast(error.message, "error");
  } finally {
    elements.refreshOrders.disabled = false;
  }
}

function renderVersionCounts() {
  const v1 = Number(state.counts.v1 || 0);
  const v2 = Number(state.counts.v2 || 0);
  const total = v1 + v2;
  elements.v1Count.textContent = String(v1);
  elements.v2Count.textContent = String(v2);
  elements.v1Bar.style.transform = `scaleX(${total ? v1 / total : 0})`;
  elements.v2Bar.style.transform = `scaleX(${total ? v2 / total : 0})`;
  sessionStorage.setItem("version-counts", JSON.stringify({ v1, v2 }));
}

elements.orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.orderForm.reportValidity()) return;

  const form = new FormData(elements.orderForm);
  const payload = {
    userId: Number(form.get("userId")),
    product: form.get("product"),
    quantity: Number(form.get("quantity"))
  };
  elements.formMessage.textContent = "";
  delete elements.formMessage.dataset.state;
  setBusy(elements.createOrder, true, "Oluşturuluyor");

  try {
    const { body } = await fetchJson("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    elements.formMessage.dataset.state = "success";
    elements.formMessage.textContent = `Sipariş #${body.id} oluşturuldu.`;
    elements.lastVersion.textContent = body.version || "—";
    state.pendingOrderId = body.id;
    showToast(`Sipariş #${body.id} kuyruğa eklendi.`);
    await loadOrders();
  } catch (error) {
    elements.formMessage.textContent = error.message;
    showToast(error.message, "error");
  } finally {
    setBusy(elements.createOrder, false, "");
  }
});

elements.probeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.probeForm.reportValidity()) return;
  const orderId = new FormData(elements.probeForm).get("probeId");
  setBusy(elements.sendProbe, true, "Gönderiliyor");
  elements.responseStatus.textContent = "Yanıt bekleniyor";

  try {
    const { body, response } = await fetchJson(`/api/orders/${encodeURIComponent(orderId)}`);
    elements.responseStatus.textContent = `HTTP ${response.status} · ${body.servedBy}`;
    elements.responseJson.textContent = JSON.stringify(body, null, 2);
    elements.lastVersion.textContent = body.version || "—";
    if (body.version === "v1" || body.version === "v2") {
      state.counts[body.version] = Number(state.counts[body.version] || 0) + 1;
      renderVersionCounts();
    }
  } catch (error) {
    elements.responseStatus.textContent = "İstek başarısız";
    elements.responseJson.textContent = JSON.stringify({ error: error.message }, null, 2);
    showToast(error.message, "error");
  } finally {
    setBusy(elements.sendProbe, false, "");
  }
});

document.querySelectorAll("[data-quantity]").forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.quantity === "increase" ? 1 : -1;
    const next = Math.min(20, Math.max(1, Number(elements.quantity.value || 1) + direction));
    elements.quantity.value = String(next);
  });
});

elements.refreshOrders.addEventListener("click", () => loadOrders({ announce: true }));
elements.resetCounts.addEventListener("click", () => {
  state.counts = { v1: 0, v2: 0 };
  renderVersionCounts();
  showToast("Sürüm sayaçları sıfırlandı.");
});

renderVersionCounts();
checkService();
loadOrders();
