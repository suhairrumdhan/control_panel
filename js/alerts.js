let alertsOrdersUnsubscribe = null;
let alertsPharmaciesUnsubscribe = null;
let alertsRequestsUnsubscribe = null;

let alertsOrders = [];
let alertsPharmacies = [];
let alertsRequests = [];

const ALERT_DELAY_RULES = {
  pending: 2 * 60 * 60 * 1000,
  reviewing: 2 * 60 * 60 * 1000,
  confirmed: 6 * 60 * 60 * 1000,
  partiallyConfirmed: 6 * 60 * 60 * 1000,
  ready: 6 * 60 * 60 * 1000
};

function renderAlertsPage() {
  contentArea.innerHTML = `
    <div class="panel-card">
      <div class="section-toolbar">
        <div>
          <h2>التنبيهات والإنذارات</h2>
          <p>مراقبة الحالات التي تحتاج متابعة إدارية داخل النظام.</p>
        </div>

        <div class="toolbar-actions">
          <input id="alertsSearchInput" class="search-input" placeholder="بحث في التنبيهات">
          <select id="alertsTypeFilter" class="filter-select">
            <option value="all">كل التنبيهات</option>
            <option value="delayed_order">طلبات متأخرة</option>
            <option value="pending_request">طلبات تسجيل معلقة</option>
            <option value="blocked_pharmacy">صيدليات محظورة</option>
            <option value="offline_pharmacy">صيدليات غير متصلة</option>
          </select>
          <select id="alertsSeverityFilter" class="filter-select">
            <option value="all">كل المستويات</option>
            <option value="high">عالية</option>
            <option value="medium">متوسطة</option>
            <option value="low">منخفضة</option>
          </select>
        </div>
      </div>

      <div id="alertsStats" class="stats-grid"></div>

      <div id="alertsList" class="alerts-list">
        <div class="empty-state">جاري تحميل التنبيهات...</div>
      </div>
    </div>
  `;

  document.getElementById("alertsSearchInput").addEventListener("input", renderAlertsList);
  document.getElementById("alertsTypeFilter").addEventListener("change", renderAlertsList);
  document.getElementById("alertsSeverityFilter").addEventListener("change", renderAlertsList);

  listenAlertsData();
}

function listenAlertsData() {
  if (alertsOrdersUnsubscribe) alertsOrdersUnsubscribe();
  if (alertsPharmaciesUnsubscribe) alertsPharmaciesUnsubscribe();
  if (alertsRequestsUnsubscribe) alertsRequestsUnsubscribe();

  alertsOrdersUnsubscribe = db.collection("orders")
    .orderBy("createdAt", "desc")
    .limit(150)
    .onSnapshot((snapshot) => {
      alertsOrders = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      renderAlertsStats();
      renderAlertsList();
    }, handleAlertsError);

  alertsPharmaciesUnsubscribe = db.collection("pharmacies")
    .orderBy("createdAt", "desc")
    .limit(150)
    .onSnapshot((snapshot) => {
      alertsPharmacies = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      renderAlertsStats();
      renderAlertsList();
    }, handleAlertsError);

  alertsRequestsUnsubscribe = db.collection("pharmacyRequests")
    .orderBy("requestDate", "desc")
    .limit(150)
    .onSnapshot((snapshot) => {
      alertsRequests = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      renderAlertsStats();
      renderAlertsList();
    }, handleAlertsError);
}

function handleAlertsError(error) {
  console.error("Alerts loading error:", error);
  const list = document.getElementById("alertsList");
  if (list) {
    list.innerHTML = `<div class="empty-state error-text">فشل تحميل التنبيهات</div>`;
  }
}

function buildAlerts() {
  const alerts = [];
  const now = Date.now();

  alertsOrders.forEach(order => {
    if (isAlertDelayedOrder(order)) {
      alerts.push({
        type: "delayed_order",
        severity: "high",
        icon: "fa-clock",
        title: `طلب متأخر: ${order.orderNumber || shortAlertId(order.docId)}`,
        description: `${order.user?.name || "مستخدم"} • ${order.pharmacy?.pharmacyName || "صيدلية غير معروفة"}`,
        meta: `الحالة: ${getAlertOrderStatus(order.status, order.statusLabel)} • العمر: ${formatAlertDuration(now - tsToAlertMs(order.createdAt))}`,
        targetId: order.docId,
        createdAt: tsToAlertMs(order.createdAt),
        actionLabel: "عرض الطلب",
        action: () => openPage("orders")
      });
    }
  });

  alertsRequests.forEach(request => {
    const status = request.status || "pending";
    const createdAt = tsToAlertMs(request.requestDate || request.createdAt);
    const age = createdAt ? now - createdAt : 0;

    if (status === "pending" && age > 24 * 60 * 60 * 1000) {
      alerts.push({
        type: "pending_request",
        severity: "medium",
        icon: "fa-clipboard-check",
        title: `طلب تسجيل معلق: ${request.pharmacyName || "-"}`,
        description: `${request.ownerName || "-"} • ${request.email || "-"}`,
        meta: `لم تتم مراجعته منذ ${formatAlertDuration(age)}`,
        targetId: request.docId,
        createdAt,
        actionLabel: "عرض طلبات التسجيل",
        action: () => openPage("requests")
      });
    }
  });

  alertsPharmacies.forEach(pharmacy => {
    const blocked = pharmacy.isBlocked === true || pharmacy.status === "blocked";

    if (blocked) {
      alerts.push({
        type: "blocked_pharmacy",
        severity: "medium",
        icon: "fa-ban",
        title: `صيدلية محظورة: ${pharmacy.pharmacyName || "-"}`,
        description: `${pharmacy.ownerName || "-"} • ${pharmacy.phoneNumber || "-"}`,
        meta: `آخر تحديث: ${formatTimestamp(pharmacy.lastStatusUpdate || pharmacy.updatedAt)}`,
        targetId: pharmacy.docId,
        createdAt: tsToAlertMs(pharmacy.lastStatusUpdate || pharmacy.updatedAt || pharmacy.createdAt),
        actionLabel: "عرض الصيدليات",
        action: () => openPage("pharmacies")
      });
    }

    if (pharmacy.status === "approved" && pharmacy.isOnline !== true && pharmacy.is24Hours !== true) {
      alerts.push({
        type: "offline_pharmacy",
        severity: "low",
        icon: "fa-wifi",
        title: `صيدلية غير متصلة: ${pharmacy.pharmacyName || "-"}`,
        description: `${pharmacy.location?.address || "-"} • ${pharmacy.phoneNumber || "-"}`,
        meta: `الحالة الحالية: أوفلاين`,
        targetId: pharmacy.docId,
        createdAt: tsToAlertMs(pharmacy.updatedAt || pharmacy.createdAt),
        actionLabel: "عرض الصيدليات",
        action: () => openPage("pharmacies")
      });
    }
  });

  return alerts.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    const s = severityOrder[b.severity] - severityOrder[a.severity];
    if (s !== 0) return s;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function renderAlertsStats() {
  const el = document.getElementById("alertsStats");
  if (!el) return;

  const alerts = buildAlerts();

  const high = alerts.filter(a => a.severity === "high").length;
  const medium = alerts.filter(a => a.severity === "medium").length;
  const low = alerts.filter(a => a.severity === "low").length;
  const delayed = alerts.filter(a => a.type === "delayed_order").length;
  const pendingRequests = alerts.filter(a => a.type === "pending_request").length;

  el.innerHTML = `
    ${alertStatCard("إجمالي التنبيهات", alerts.length, "fa-triangle-exclamation")}
    ${alertStatCard("عالية", high, "fa-circle-exclamation", "danger")}
    ${alertStatCard("متوسطة", medium, "fa-clock", "warning")}
    ${alertStatCard("منخفضة", low, "fa-info-circle")}
    ${alertStatCard("طلبات متأخرة", delayed, "fa-truck-fast", "danger")}
    ${alertStatCard("طلبات تسجيل معلقة", pendingRequests, "fa-clipboard-check", "warning")}
  `;

  setText("alertsCount", alerts.length);
}

function alertStatCard(label, value, icon, tone = "primary") {
  return `
    <div class="stat-card ${tone}">
      <i class="fa-solid ${icon}"></i>
      <h3>${value}</h3>
      <p>${label}</p>
    </div>
  `;
}

function renderAlertsList() {
  const container = document.getElementById("alertsList");
  if (!container) return;

  const search = document.getElementById("alertsSearchInput")?.value.trim().toLowerCase() || "";
  const typeFilter = document.getElementById("alertsTypeFilter")?.value || "all";
  const severityFilter = document.getElementById("alertsSeverityFilter")?.value || "all";

  const alerts = buildAlerts().filter(alert => {
    const text = [
      alert.title,
      alert.description,
      alert.meta,
      alert.targetId
    ].join(" ").toLowerCase();

    const matchType = typeFilter === "all" || alert.type === typeFilter;
    const matchSeverity = severityFilter === "all" || alert.severity === severityFilter;

    return matchType && matchSeverity && text.includes(search);
  });

  if (alerts.length === 0) {
    container.innerHTML = `<div class="empty-state">لا توجد تنبيهات مطابقة</div>`;
    return;
  }

  container.innerHTML = alerts.map((alert, index) => {
    const severityInfo = getAlertSeverity(alert.severity);

    return `
      <div class="alert-card ${alert.severity}">
        <div class="alert-icon">
          <i class="fa-solid ${alert.icon}"></i>
        </div>

        <div class="alert-content">
          <div class="alert-header">
            <h3>${escapeHtml(alert.title)}</h3>
            <span class="status-badge ${severityInfo.className}">${severityInfo.label}</span>
          </div>

          <p>${escapeHtml(alert.description)}</p>
          <small>${escapeHtml(alert.meta)}</small>
        </div>

        <button class="small-btn" onclick="runAlertAction(${index})">
          <i class="fa-solid fa-arrow-left"></i>
          ${escapeHtml(alert.actionLabel)}
        </button>
      </div>
    `;
  }).join("");

  window.currentRenderedAlerts = alerts;
}

function runAlertAction(index) {
  const alerts = window.currentRenderedAlerts || [];
  const alert = alerts[index];

  if (alert && typeof alert.action === "function") {
    alert.action();
  }
}

function isAlertDelayedOrder(order) {
  const status = order.status || "pending";
  const rule = ALERT_DELAY_RULES[status];

  if (!rule) return false;

  const createdAt = tsToAlertMs(order.createdAt);
  if (!createdAt) return false;

  return (Date.now() - createdAt) > rule;
}

function getAlertSeverity(severity) {
  const map = {
    high: { label: "عالية", className: "status-rejected" },
    medium: { label: "متوسطة", className: "status-pending" },
    low: { label: "منخفضة", className: "status-approved" }
  };

  return map[severity] || map.low;
}

function getAlertOrderStatus(status, label) {
  const map = {
    pending: "معلق",
    reviewing: "قيد المراجعة",
    confirmed: "تم التأكيد",
    partiallyConfirmed: "متوفر جزئيًا",
    ready: "جاهز",
    completed: "مكتمل",
    rejected: "مرفوض",
    cancelled: "ملغي"
  };

  return map[status] || label || status || "غير معروف";
}

function tsToAlertMs(ts) {
  if (!ts) return null;

  try {
    if (ts.seconds) return ts.seconds * 1000;
    const date = new Date(ts);
    const ms = date.getTime();
    return Number.isNaN(ms) ? null : ms;
  } catch (_) {
    return null;
  }
}

function formatAlertDuration(ms) {
  if (!ms || ms < 0) return "-";

  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);

  if (days > 0) return `${days}ي ${hours}س`;
  if (hours > 0) return `${hours}س ${minutes}د`;
  return `${minutes}د`;
}

function shortAlertId(id) {
  if (!id) return "-";
  return id.length > 8 ? id.substring(0, 8) : id;
}