let reportsOrders = [];
let reportsUsers = [];
let reportsPharmacies = [];
let reportsRequests = [];

let reportsOrdersUnsubscribe = null;
let reportsUsersUnsubscribe = null;
let reportsPharmaciesUnsubscribe = null;
let reportsRequestsUnsubscribe = null;

function renderReportsPage() {
  contentArea.innerHTML = `
    <div class="panel-card">
      <div class="section-toolbar">
        <div>
          <h2>التقارير والإحصائيات</h2>
          <p>إحصائيات تشغيلية وتحليلية للنظام.</p>
        </div>

        <div class="toolbar-actions">
          <select id="reportsRangeFilter" class="filter-select">
            <option value="7">آخر 7 أيام</option>
            <option value="30" selected>آخر 30 يوم</option>
            <option value="90">آخر 90 يوم</option>
            <option value="365">آخر سنة</option>
          </select>

          <button class="small-btn" onclick="refreshReports()">
            <i class="fa-solid fa-rotate"></i>
            تحديث
          </button>
        </div>
      </div>

      <div id="reportsStatsGrid" class="stats-grid"></div>
    </div>

    <div class="reports-grid">
      <div class="panel-card">
        <h2>إحصائيات الطلبات</h2>
        <div id="ordersReportCards" class="report-cards"></div>
      </div>

      <div class="panel-card">
        <h2>إحصائيات الصيدليات</h2>
        <div id="pharmaciesReportCards" class="report-cards"></div>
      </div>

      <div class="panel-card">
        <h2>إحصائيات المستخدمين</h2>
        <div id="usersReportCards" class="report-cards"></div>
      </div>

      <div class="panel-card">
        <h2>ملخص الأداء</h2>
        <div id="systemHealthCards" class="report-cards"></div>
      </div>
    </div>

    <div class="panel-card mt-18">
      <h2>أكثر حالات الطلبات</h2>

      <div class="table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>الحالة</th>
              <th>عدد الطلبات</th>
              <th>النسبة</th>
            </tr>
          </thead>

          <tbody id="ordersStatusTable">
            <tr>
              <td colspan="3" class="table-empty">جاري تحميل البيانات...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel-card mt-18">
      <h2>آخر النشاطات داخل النظام</h2>
      <div id="recentActivityList" class="mini-list">
        <div class="empty-state">جاري تحميل النشاطات...</div>
      </div>
    </div>
  `;

  listenReportsData();
}

function refreshReports() {
  renderReports();
}

function listenReportsData() {
  if (reportsOrdersUnsubscribe) reportsOrdersUnsubscribe();
  if (reportsUsersUnsubscribe) reportsUsersUnsubscribe();
  if (reportsPharmaciesUnsubscribe) reportsPharmaciesUnsubscribe();
  if (reportsRequestsUnsubscribe) reportsRequestsUnsubscribe();

  reportsOrdersUnsubscribe = db.collection("orders")
    .orderBy("createdAt", "desc")
    .limit(500)
    .onSnapshot((snapshot) => {
      reportsOrders = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));

      renderReports();
    });

  reportsUsersUnsubscribe = db.collection("users")
    .orderBy("createdAt", "desc")
    .limit(500)
    .onSnapshot((snapshot) => {
      reportsUsers = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));

      renderReports();
    });

  reportsPharmaciesUnsubscribe = db.collection("pharmacies")
    .orderBy("createdAt", "desc")
    .limit(300)
    .onSnapshot((snapshot) => {
      reportsPharmacies = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));

      renderReports();
    });

  reportsRequestsUnsubscribe = db.collection("pharmacyRequests")
    .orderBy("requestDate", "desc")
    .limit(300)
    .onSnapshot((snapshot) => {
      reportsRequests = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));

      renderReports();
    });
}

function renderReports() {
  renderReportsStats();
  renderOrdersReports();
  renderPharmacyReports();
  renderUsersReports();
  renderSystemHealth();
  renderOrdersStatusTable();
  renderRecentActivity();
}

function renderReportsStats() {
  const grid = document.getElementById("reportsStatsGrid");
  if (!grid) return;

  const completedOrders = reportsOrders.filter(o => o.status === "completed").length;
  const approvedPharmacies = reportsPharmacies.filter(p => p.status === "approved").length;
  const blockedUsers = reportsUsers.filter(u => u.isBlocked === true).length;
  const pendingRequests = reportsRequests.filter(r => (r.status || "pending") === "pending").length;

  grid.innerHTML = `
    ${reportStatCard("إجمالي الطلبات", reportsOrders.length, "fa-cart-shopping")}
    ${reportStatCard("طلبات مكتملة", completedOrders, "fa-circle-check", "success")}
    ${reportStatCard("الصيدليات المعتمدة", approvedPharmacies, "fa-house-medical")}
    ${reportStatCard("طلبات التسجيل المعلقة", pendingRequests, "fa-clipboard-check", "warning")}
    ${reportStatCard("المستخدمون المحظورون", blockedUsers, "fa-user-lock", "danger")}
  `;
}

function reportStatCard(label, value, icon, tone = "primary") {
  return `
    <div class="stat-card ${tone}">
      <i class="fa-solid ${icon}"></i>
      <h3>${value}</h3>
      <p>${label}</p>
    </div>
  `;
}

function renderOrdersReports() {
  const el = document.getElementById("ordersReportCards");
  if (!el) return;

  const completed = reportsOrders.filter(o => o.status === "completed").length;
  const pending = reportsOrders.filter(o => o.status === "pending").length;
  const cancelled = reportsOrders.filter(o => o.status === "cancelled").length;
  const ready = reportsOrders.filter(o => o.status === "ready").length;

  el.innerHTML = `
    ${reportInfoCard("مكتملة", completed)}
    ${reportInfoCard("معلقة", pending)}
    ${reportInfoCard("جاهزة", ready)}
    ${reportInfoCard("ملغية", cancelled)}
  `;
}

function renderPharmacyReports() {
  const el = document.getElementById("pharmaciesReportCards");
  if (!el) return;

  const approved = reportsPharmacies.filter(p => p.status === "approved").length;
  const blocked = reportsPharmacies.filter(p => p.isBlocked === true).length;
  const online = reportsPharmacies.filter(p => p.isOnline === true).length;
  const offline = reportsPharmacies.filter(p => p.isOnline !== true).length;

  el.innerHTML = `
    ${reportInfoCard("معتمدة", approved)}
    ${reportInfoCard("محظورة", blocked)}
    ${reportInfoCard("متصلة", online)}
    ${reportInfoCard("غير متصلة", offline)}
  `;
}

function renderUsersReports() {
  const el = document.getElementById("usersReportCards");
  if (!el) return;

  const total = reportsUsers.length;
  const blocked = reportsUsers.filter(u => u.isBlocked === true).length;
  const insured = reportsUsers.filter(u => Number(u.insurancesCount || 0) > 0).length;
  const family = reportsUsers.filter(u => Number(u.familyMembersCount || 0) > 0).length;

  el.innerHTML = `
    ${reportInfoCard("إجمالي المستخدمين", total)}
    ${reportInfoCard("محظورون", blocked)}
    ${reportInfoCard("لديهم تأمين", insured)}
    ${reportInfoCard("لديهم عائلة", family)}
  `;
}

function renderSystemHealth() {
  const el = document.getElementById("systemHealthCards");
  if (!el) return;

  const ordersCount = reportsOrders.length || 1;

  const completionRate = Math.round(
    (reportsOrders.filter(o => o.status === "completed").length / ordersCount) * 100
  );

  const approvalRate = Math.round(
    (reportsRequests.filter(r => r.status === "approved").length /
      (reportsRequests.length || 1)) * 100
  );

  const pharmaciesOnlineRate = Math.round(
    (reportsPharmacies.filter(p => p.isOnline === true).length /
      (reportsPharmacies.length || 1)) * 100
  );

  el.innerHTML = `
    ${healthCard("معدل اكتمال الطلبات", `${completionRate}%`)}
    ${healthCard("معدل قبول الصيدليات", `${approvalRate}%`)}
    ${healthCard("الصيدليات المتصلة", `${pharmaciesOnlineRate}%`)}
    ${healthCard("حالة النظام", "مستقر")}
  `;
}

function renderOrdersStatusTable() {
  const tbody = document.getElementById("ordersStatusTable");
  if (!tbody) return;

  if (reportsOrders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="table-empty">لا توجد بيانات</td>
      </tr>
    `;
    return;
  }

  const statuses = {};

  reportsOrders.forEach(order => {
    const status = order.status || "unknown";
    statuses[status] = (statuses[status] || 0) + 1;
  });

  const rows = Object.entries(statuses)
    .sort((a, b) => b[1] - a[1]);

  tbody.innerHTML = rows.map(([status, count]) => {
    const percent = Math.round((count / reportsOrders.length) * 100);

    return `
      <tr>
        <td>${escapeHtml(formatReportOrderStatus(status))}</td>
        <td>${count}</td>
        <td>
          <div class="progress-wrapper">
            <div class="progress-bar">
              <div class="progress-fill" style="width:${percent}%"></div>
            </div>
            <span>${percent}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderRecentActivity() {
  const container = document.getElementById("recentActivityList");
  if (!container) return;

  const activities = [];

  reportsOrders.slice(0, 5).forEach(order => {
    activities.push({
      title: `طلب جديد ${order.orderNumber || shortReportId(order.docId)}`,
      subtitle: `${order.user?.name || "مستخدم"} • ${formatTimestamp(order.createdAt)}`,
      badge: formatReportOrderStatus(order.status)
    });
  });

  reportsRequests.slice(0, 5).forEach(request => {
    activities.push({
      title: `طلب تسجيل صيدلية`,
      subtitle: `${request.pharmacyName || "-"} • ${formatTimestamp(request.requestDate || request.createdAt)}`,
      badge: request.status || "pending"
    });
  });

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">لا توجد نشاطات حديثة</div>
    `;
    return;
  }

  container.innerHTML = activities.map(item => `
    <div class="mini-row">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.subtitle)}</span>
      </div>

      <b class="status-badge status-approved">
        ${escapeHtml(item.badge)}
      </b>
    </div>
  `).join("");
}

function reportInfoCard(label, value) {
  return `
    <div class="report-info-card">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `;
}

function healthCard(label, value) {
  return `
    <div class="health-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function formatReportOrderStatus(status) {
  const map = {
    pending: "معلق",
    reviewing: "قيد المراجعة",
    confirmed: "تم التأكيد",
    partiallyConfirmed: "متوفر جزئيًا",
    ready: "جاهز",
    completed: "مكتمل",
    cancelled: "ملغي",
    rejected: "مرفوض"
  };

  return map[status] || status || "غير معروف";
}

function shortReportId(id) {
  if (!id) return "-";
  return id.substring(0, 8);
}