let dashboardUnsubscribers = [];

let dashboardRequests = [];
let dashboardPharmacies = [];
let dashboardOrders = [];
let dashboardUsers = [];

function renderDashboard() {
  contentArea.innerHTML = `
    <div id="dashboardStats" class="stats-grid"></div>

    <div class="dashboard-grid">
      <div class="panel-card">
        <div class="section-toolbar compact">
          <div>
            <h2>آخر الطلبات</h2>
            <p>أحدث العمليات التشغيلية داخل النظام</p>
          </div>
          <button class="small-btn" onclick="openPage('orders')">
            عرض الكل
          </button>
        </div>

        <div id="latestOrdersList" class="mini-list">
          <div class="empty-state">جاري التحميل...</div>
        </div>
      </div>

      <div class="panel-card">
        <div class="section-toolbar compact">
          <div>
            <h2>طلبات تسجيل الصيدليات</h2>
            <p>آخر طلبات الانضمام للنظام</p>
          </div>
          <button class="small-btn" onclick="openPage('requests')">
            مراجعة
          </button>
        </div>

        <div id="latestRequestsList" class="mini-list">
          <div class="empty-state">جاري التحميل...</div>
        </div>
      </div>
    </div>

    <div class="dashboard-grid mt-18">
      <div class="panel-card">
        <h2>مؤشرات الصيدليات</h2>
        <div id="pharmacyIndicators" class="indicator-list"></div>
      </div>

      <div class="panel-card">
        <h2>مؤشرات النظام</h2>
        <div id="systemIndicators" class="indicator-list"></div>
      </div>
    </div>
  `;

  listenDashboardStats();
}

function listenDashboardStats() {
  clearDashboardListeners();

  dashboardUnsubscribers.push(
    db.collection("pharmacyRequests")
      .orderBy("requestDate", "desc")
      .limit(100)
      .onSnapshot(snapshot => {
        dashboardRequests = snapshot.docs.map(doc => ({
          docId: doc.id,
          ...doc.data()
        }));
        updateDashboard();
      })
  );

  dashboardUnsubscribers.push(
    db.collection("pharmacies")
      .orderBy("createdAt", "desc")
      .limit(100)
      .onSnapshot(snapshot => {
        dashboardPharmacies = snapshot.docs.map(doc => ({
          docId: doc.id,
          ...doc.data()
        }));
        updateDashboard();
      })
  );

  dashboardUnsubscribers.push(
    db.collection("orders")
      .orderBy("createdAt", "desc")
      .limit(150)
      .onSnapshot(snapshot => {
        dashboardOrders = snapshot.docs.map(doc => ({
          docId: doc.id,
          ...doc.data()
        }));
        updateDashboard();
      })
  );

  dashboardUnsubscribers.push(
    db.collection("users")
      .orderBy("createdAt", "desc")
      .limit(150)
      .onSnapshot(snapshot => {
        dashboardUsers = snapshot.docs.map(doc => ({
          docId: doc.id,
          ...doc.data()
        }));
        updateDashboard();
      })
  );
}

function clearDashboardListeners() {
  dashboardUnsubscribers.forEach(unsub => {
    if (typeof unsub === "function") unsub();
  });

  dashboardUnsubscribers = [];
}

function updateDashboard() {
  renderDashboardStats();
  renderLatestOrders();
  renderLatestRequests();
  renderPharmacyIndicators();
  renderSystemIndicators();
}

function renderDashboardStats() {
  const container = document.getElementById("dashboardStats");
  if (!container) return;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const pendingRequests = dashboardRequests.filter(r => (r.status || "pending") === "pending").length;
  const approvedPharmacies = dashboardPharmacies.filter(p => p.status === "approved" && p.isBlocked !== true).length;
  const totalUsers = dashboardUsers.length;
  const todayOrders = dashboardOrders.filter(o => {
    const createdAt = dashboardTsToMs(o.createdAt);
    return createdAt && createdAt >= todayStart.getTime();
  }).length;

  const delayedOrders = dashboardOrders.filter(isDashboardOrderDelayed).length;
  const completedOrders = dashboardOrders.filter(o => o.status === "completed").length;

  container.innerHTML = `
    ${dashboardStatCard("المستخدمون", totalUsers, "fa-users")}
    ${dashboardStatCard("الصيدليات المعتمدة", approvedPharmacies, "fa-house-medical")}
    ${dashboardStatCard("طلبات تسجيل معلقة", pendingRequests, "fa-clipboard-check", "warning")}
    ${dashboardStatCard("طلبات اليوم", todayOrders, "fa-cart-shopping")}
    ${dashboardStatCard("طلبات متأخرة", delayedOrders, "fa-clock", "danger")}
    ${dashboardStatCard("طلبات مكتملة", completedOrders, "fa-circle-check", "success")}
  `;

  setText("pendingBadge", pendingRequests);
  setText("pendingCount", pendingRequests);
  setText("approvedCount", approvedPharmacies);
  setText("rejectedCount", dashboardRequests.filter(r => r.status === "rejected").length);
  setText("alertsCount", delayedOrders);
}

function dashboardStatCard(label, value, icon, tone = "primary") {
  return `
    <div class="stat-card ${tone}">
      <i class="fa-solid ${icon}"></i>
      <h3>${value}</h3>
      <p>${label}</p>
    </div>
  `;
}

function renderLatestOrders() {
  const container = document.getElementById("latestOrdersList");
  if (!container) return;

  const latest = dashboardOrders.slice(0, 6);

  if (latest.length === 0) {
    container.innerHTML = `<div class="empty-state">لا توجد طلبات بعد</div>`;
    return;
  }

  container.innerHTML = latest.map(order => {
    const status = getDashboardOrderStatus(order.status, order.statusLabel);

    return `
      <div class="mini-row">
        <div>
          <strong>${escapeHtml(order.orderNumber || shortDashboardId(order.docId))}</strong>
          <span>${escapeHtml(order.user?.name || "-")} • ${escapeHtml(order.pharmacy?.pharmacyName || "-")}</span>
          <span>${formatTimestamp(order.createdAt)}</span>
        </div>
        <b class="status-badge ${status.className}">${status.label}</b>
      </div>
    `;
  }).join("");
}

function renderLatestRequests() {
  const container = document.getElementById("latestRequestsList");
  if (!container) return;

  const latest = dashboardRequests.slice(0, 6);

  if (latest.length === 0) {
    container.innerHTML = `<div class="empty-state">لا توجد طلبات تسجيل بعد</div>`;
    return;
  }

  container.innerHTML = latest.map(request => {
    const status = getDashboardRequestStatus(request.status);

    return `
      <div class="mini-row">
        <div>
          <strong>${escapeHtml(request.pharmacyName || "-")}</strong>
          <span>${escapeHtml(request.ownerName || "-")} • ${escapeHtml(request.email || "-")}</span>
          <span>${formatTimestamp(request.requestDate || request.createdAt)}</span>
        </div>
        <b class="status-badge ${status.className}">${status.label}</b>
      </div>
    `;
  }).join("");
}

function renderPharmacyIndicators() {
  const container = document.getElementById("pharmacyIndicators");
  if (!container) return;

  const total = dashboardPharmacies.length || 1;
  const approved = dashboardPharmacies.filter(p => p.status === "approved").length;
  const online = dashboardPharmacies.filter(p => p.isOnline === true).length;
  const blocked = dashboardPharmacies.filter(p => p.isBlocked === true || p.status === "blocked").length;
  const h24 = dashboardPharmacies.filter(p => p.is24Hours === true).length;

  container.innerHTML = `
    ${indicatorRow("نسبة الصيدليات المعتمدة", percent(approved, total))}
    ${indicatorRow("الصيدليات المتصلة", percent(online, total))}
    ${indicatorRow("الصيدليات 24 ساعة", percent(h24, total))}
    ${indicatorRow("الصيدليات المحظورة", percent(blocked, total))}
  `;
}

function renderSystemIndicators() {
  const container = document.getElementById("systemIndicators");
  if (!container) return;

  const totalOrders = dashboardOrders.length || 1;
  const completed = dashboardOrders.filter(o => o.status === "completed").length;
  const cancelled = dashboardOrders.filter(o => o.status === "cancelled" || o.status === "rejected").length;
  const delayed = dashboardOrders.filter(isDashboardOrderDelayed).length;

  const approvedRequests = dashboardRequests.filter(r => r.status === "approved").length;
  const totalRequests = dashboardRequests.length || 1;

  container.innerHTML = `
    ${indicatorRow("معدل اكتمال الطلبات", percent(completed, totalOrders))}
    ${indicatorRow("معدل الطلبات الملغية/المرفوضة", percent(cancelled, totalOrders))}
    ${indicatorRow("معدل الطلبات المتأخرة", percent(delayed, totalOrders))}
    ${indicatorRow("معدل قبول الصيدليات", percent(approvedRequests, totalRequests))}
  `;
}

function indicatorRow(label, value) {
  const width = parseInt(value) || 0;

  return `
    <div class="indicator-row">
      <div>
        <span>${label}</span>
        <strong>${value}</strong>
      </div>

      <div class="progress-bar full">
        <div class="progress-fill" style="width:${width}%"></div>
      </div>
    </div>
  `;
}

function isDashboardOrderDelayed(order) {
  const status = order.status || "pending";

  const rules = {
    pending: 2 * 60 * 60 * 1000,
    reviewing: 2 * 60 * 60 * 1000,
    confirmed: 6 * 60 * 60 * 1000,
    partiallyConfirmed: 6 * 60 * 60 * 1000,
    ready: 6 * 60 * 60 * 1000
  };

  const rule = rules[status];
  if (!rule) return false;

  const createdAt = dashboardTsToMs(order.createdAt);
  if (!createdAt) return false;

  return Date.now() - createdAt > rule;
}

function getDashboardOrderStatus(status, label) {
  const map = {
    pending: { label: "معلق", className: "status-pending" },
    reviewing: { label: "قيد المراجعة", className: "status-pending" },
    confirmed: { label: "تم التأكيد", className: "status-approved" },
    partiallyConfirmed: { label: "متوفر جزئيًا", className: "status-pending" },
    ready: { label: "جاهز", className: "status-approved" },
    completed: { label: "مكتمل", className: "status-approved" },
    rejected: { label: "مرفوض", className: "status-rejected" },
    cancelled: { label: "ملغي", className: "status-rejected" }
  };

  return map[status] || {
    label: label || status || "غير معروف",
    className: "status-pending"
  };
}

function getDashboardRequestStatus(status) {
  if (status === "approved") {
    return { label: "معتمد", className: "status-approved" };
  }

  if (status === "rejected") {
    return { label: "مرفوض", className: "status-rejected" };
  }

  return { label: "قيد الانتظار", className: "status-pending" };
}

function dashboardTsToMs(ts) {
  if (!ts) return null;

  try {
    if (ts.seconds) return ts.seconds * 1000;

    const ms = new Date(ts).getTime();
    return Number.isNaN(ms) ? null : ms;
  } catch (_) {
    return null;
  }
}

function percent(value, total) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function shortDashboardId(id) {
  if (!id) return "-";
  return id.length > 8 ? id.substring(0, 8) : id;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}