let auditLogsUnsubscribe = null;
let allAuditLogs = [];

function renderAuditLogsPage() {
  contentArea.innerHTML = `
    <div class="panel-card">
      <div class="section-toolbar">
        <div>
          <h2>سجل العمليات</h2>
          <p>تتبع العمليات الإدارية التي تم تنفيذها داخل لوحة التحكم.</p>
        </div>

        <div class="toolbar-actions">
          <input id="auditSearchInput" class="search-input" placeholder="بحث بالعملية، المسؤول، الهدف">
          <select id="auditModuleFilter" class="filter-select">
            <option value="all">كل الوحدات</option>
            <option value="pharmacy_requests">طلبات الصيدليات</option>
            <option value="pharmacies">الصيدليات</option>
            <option value="users">المستخدمون</option>
            <option value="notifications">الإشعارات</option>
          </select>
          <select id="auditActionFilter" class="filter-select">
            <option value="all">كل العمليات</option>
            <option value="approve_pharmacy_request">قبول صيدلية</option>
            <option value="reject_pharmacy_request">رفض صيدلية</option>
            <option value="block_pharmacy">حظر صيدلية</option>
            <option value="unblock_pharmacy">فك حظر صيدلية</option>
            <option value="block_user">حظر مستخدم</option>
            <option value="unblock_user">فك حظر مستخدم</option>
            <option value="send_broadcast_notification">إرسال إشعار</option>
          </select>
        </div>
      </div>

      <div id="auditStats" class="stats-grid"></div>

      <div class="table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>العملية</th>
              <th>الوحدة</th>
              <th>الهدف</th>
              <th>المسؤول</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th>التفاصيل</th>
            </tr>
          </thead>
          <tbody id="auditTableBody">
            <tr>
              <td colspan="7" class="table-empty">جاري تحميل سجل العمليات...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="auditModal" class="modal-overlay hidden">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h2 id="auditModalTitle">تفاصيل العملية</h2>
            <p id="auditModalSubtitle">-</p>
          </div>
          <button class="icon-btn" onclick="closeAuditModal()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div id="auditDetailsGrid" class="details-grid"></div>

        <div class="panel-card inner-panel">
          <h2>البيانات الخام</h2>
          <pre id="auditRawData" class="code-preview"></pre>
        </div>
      </div>
    </div>
  `;

  document.getElementById("auditSearchInput").addEventListener("input", renderAuditTable);
  document.getElementById("auditModuleFilter").addEventListener("change", renderAuditTable);
  document.getElementById("auditActionFilter").addEventListener("change", renderAuditTable);

  listenAuditLogs();
}

function listenAuditLogs() {
  if (auditLogsUnsubscribe) auditLogsUnsubscribe();

  auditLogsUnsubscribe = db.collection("adminAuditLogs")
    .orderBy("createdAt", "desc")
    .limit(300)
    .onSnapshot((snapshot) => {
      allAuditLogs = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));

      renderAuditStats();
      renderAuditTable();
    }, (error) => {
      console.error("Load audit logs error:", error);
      document.getElementById("auditTableBody").innerHTML = `
        <tr>
          <td colspan="7" class="table-empty error-text">فشل تحميل سجل العمليات</td>
        </tr>
      `;
    });
}

function renderAuditStats() {
  const el = document.getElementById("auditStats");
  if (!el) return;

  const total = allAuditLogs.length;
  const success = allAuditLogs.filter(log => log.status === "success").length;
  const pharmacyRequests = allAuditLogs.filter(log => log.module === "pharmacy_requests").length;
  const pharmacies = allAuditLogs.filter(log => log.module === "pharmacies").length;
  const users = allAuditLogs.filter(log => log.module === "users").length;
  const notifications = allAuditLogs.filter(log => log.module === "notifications").length;

  el.innerHTML = `
    ${auditStatCard("إجمالي العمليات", total, "fa-list-check")}
    ${auditStatCard("عمليات ناجحة", success, "fa-circle-check", "success")}
    ${auditStatCard("طلبات الصيدليات", pharmacyRequests, "fa-clipboard-check")}
    ${auditStatCard("الصيدليات", pharmacies, "fa-house-medical")}
    ${auditStatCard("المستخدمون", users, "fa-users")}
    ${auditStatCard("الإشعارات", notifications, "fa-bell")}
  `;
}

function auditStatCard(label, value, icon, tone = "primary") {
  return `
    <div class="stat-card ${tone}">
      <i class="fa-solid ${icon}"></i>
      <h3>${value}</h3>
      <p>${label}</p>
    </div>
  `;
}

function renderAuditTable() {
  const tbody = document.getElementById("auditTableBody");
  if (!tbody) return;

  const search = document.getElementById("auditSearchInput")?.value.trim().toLowerCase() || "";
  const moduleFilter = document.getElementById("auditModuleFilter")?.value || "all";
  const actionFilter = document.getElementById("auditActionFilter")?.value || "all";

  const filtered = allAuditLogs.filter(log => {
    const matchModule = moduleFilter === "all" || log.module === moduleFilter;
    const matchAction = actionFilter === "all" || log.action === actionFilter;

    const text = [
      log.action,
      log.module,
      log.targetType,
      log.targetId,
      log.targetName,
      log.performedBy?.email,
      log.performedBy?.name,
      log.reason,
      log.source
    ].join(" ").toLowerCase();

    return matchModule && matchAction && text.includes(search);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">لا توجد عمليات مطابقة</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(log => {
    const action = formatAuditAction(log.action);
    const moduleName = formatAuditModule(log.module);
    const status = formatAuditStatus(log.status);

    return `
      <tr>
        <td>
          <div class="table-title">${escapeHtml(action)}</div>
          <div class="table-subtitle">${escapeHtml(log.action || "-")}</div>
        </td>

        <td>${escapeHtml(moduleName)}</td>

        <td>
          <div class="table-title">${escapeHtml(log.targetName || "-")}</div>
          <div class="table-subtitle">${escapeHtml(log.targetId || "-")}</div>
        </td>

        <td>
          <div class="table-title">${escapeHtml(log.performedBy?.name || "Admin")}</div>
          <div class="table-subtitle">${escapeHtml(log.performedBy?.email || "-")}</div>
        </td>

        <td>
          <span class="status-badge ${status.className}">${status.label}</span>
        </td>

        <td>${formatTimestamp(log.createdAt)}</td>

        <td>
          <button class="small-btn" onclick="openAuditModal('${log.docId}')">
            <i class="fa-solid fa-eye"></i>
            عرض
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function openAuditModal(logId) {
  const log = allAuditLogs.find(item => item.docId === logId);
  if (!log) return;

  document.getElementById("auditModalTitle").textContent = formatAuditAction(log.action);
  document.getElementById("auditModalSubtitle").textContent =
    `${formatAuditModule(log.module)} • ${formatTimestamp(log.createdAt)}`;

  document.getElementById("auditDetailsGrid").innerHTML = `
    ${detailItem("معرف السجل", log.docId)}
    ${detailItem("نوع العملية", formatAuditAction(log.action))}
    ${detailItem("الوحدة", formatAuditModule(log.module))}
    ${detailItem("نوع الهدف", log.targetType)}
    ${detailItem("معرف الهدف", log.targetId)}
    ${detailItem("اسم الهدف", log.targetName)}
    ${detailItem("الحالة", formatAuditStatus(log.status).label)}
    ${detailItem("المصدر", log.source)}
    ${detailItem("المسؤول", log.performedBy?.name || "Admin")}
    ${detailItem("بريد المسؤول", log.performedBy?.email)}
    ${detailItem("سبب/ملاحظة", log.reason)}
    ${detailItem("تاريخ التنفيذ", formatTimestamp(log.createdAt))}
  `;

  document.getElementById("auditRawData").textContent = safeJsonStringify(log);

  document.getElementById("auditModal").classList.remove("hidden");
}

function closeAuditModal() {
  document.getElementById("auditModal").classList.add("hidden");
}

function formatAuditAction(action) {
  const map = {
    approve_pharmacy_request: "قبول طلب تسجيل صيدلية",
    reject_pharmacy_request: "رفض طلب تسجيل صيدلية",
    block_pharmacy: "حظر صيدلية",
    unblock_pharmacy: "فك حظر صيدلية",
    block_user: "حظر مستخدم",
    unblock_user: "فك حظر مستخدم",
    send_broadcast_notification: "إرسال إشعار جماعي"
  };

  return map[action] || action || "عملية غير معروفة";
}

function formatAuditModule(module) {
  const map = {
    pharmacy_requests: "طلبات تسجيل الصيدليات",
    pharmacies: "الصيدليات",
    users: "المستخدمون",
    notifications: "الإشعارات"
  };

  return map[module] || module || "-";
}

function formatAuditStatus(status) {
  if (status === "success") {
    return {
      label: "ناجحة",
      className: "status-approved"
    };
  }

  if (status === "failed") {
    return {
      label: "فاشلة",
      className: "status-rejected"
    };
  }

  return {
    label: status || "غير محددة",
    className: "status-pending"
  };
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(cleanFirestoreData(value), null, 2);
  } catch (_) {
    return "تعذر عرض البيانات";
  }
}

function cleanFirestoreData(value) {
  if (value === null || value === undefined) return value;

  if (typeof value !== "object") return value;

  if (value.seconds !== undefined && value.nanoseconds !== undefined) {
    return formatTimestamp(value);
  }

  if (Array.isArray(value)) {
    return value.map(cleanFirestoreData);
  }

  const result = {};

  Object.keys(value).forEach(key => {
    result[key] = cleanFirestoreData(value[key]);
  });

  return result;
}