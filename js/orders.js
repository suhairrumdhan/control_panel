let ordersUnsubscribe = null;
let allOrders = [];
let selectedOrderId = null;

// ===== Config (عدّليها حسب سياساتك)
const DELAY_RULES = {
  pending: 2 * 60 * 60 * 1000,          // 2 ساعات
  reviewing: 2 * 60 * 60 * 1000,
  confirmed: 6 * 60 * 60 * 1000,
  ready: 6 * 60 * 60 * 1000
};

function renderOrdersPage() {
  contentArea.innerHTML = `
    <div class="panel-card">
      <div class="section-toolbar">
        <div>
          <h2>مراقبة الطلبات</h2>
          <p>رؤية تشغيلية لحالة الطلبات داخل النظام</p>
        </div>

        <div class="toolbar-actions">
          <input id="orderSearch" class="search-input" placeholder="بحث برقم الطلب، المستخدم، الصيدلية">
          <select id="orderStatusFilter" class="filter-select">
            <option value="all">كل الحالات</option>
            <option value="pending">معلقة</option>
            <option value="reviewing">قيد المراجعة</option>
            <option value="confirmed">تم التأكيد</option>
            <option value="partiallyConfirmed">متوفر جزئيًا</option>
            <option value="ready">جاهز</option>
            <option value="completed">مكتمل</option>
            <option value="rejected">مرفوض</option>
            <option value="cancelled">ملغي</option>
          </select>
          <label class="chip">
            <input type="checkbox" id="onlyDelayed"> المتأخرة فقط
          </label>
        </div>
      </div>

      <div id="ordersStats" class="stats-grid"></div>

      <div class="table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>الطلب</th>
              <th>المسار</th>
              <th>المستخدم / المستفيد</th>
              <th>الصيدلية</th>
              <th>الأدوية</th>
              <th>القيمة</th>
              <th>الحالة</th>
              <th>العمر</th>
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody id="ordersTable">
            <tr><td colspan="9" class="table-empty">جاري التحميل...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="orderModal" class="modal-overlay hidden">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h2 id="orderModalTitle">تفاصيل الطلب</h2>
            <p id="orderModalSubtitle">-</p>
          </div>
          <button class="icon-btn" onclick="closeOrderModal()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div id="orderSummaryGrid" class="details-grid"></div>

        <div class="panel-card inner-panel">
          <h2>الأدوية المطلوبة</h2>
          <div id="orderMedicinesList" class="medicine-list"></div>
        </div>

        <div class="panel-card inner-panel">
          <h2>سجل الحالة</h2>
          <div id="orderStatusTimeline" class="timeline"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("orderSearch").addEventListener("input", renderOrdersTable);
  document.getElementById("orderStatusFilter").addEventListener("change", renderOrdersTable);
  document.getElementById("onlyDelayed").addEventListener("change", renderOrdersTable);

  listenOrders();
}

function listenOrders() {
  if (ordersUnsubscribe) ordersUnsubscribe();

  ordersUnsubscribe = db.collection("orders")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      allOrders = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));

      renderOrdersStats();
      renderOrdersTable();
      renderOrdersInsights();
    }, (error) => {
      console.error("Orders loading error:", error);
      document.getElementById("ordersTable").innerHTML = `
        <tr><td colspan="9" class="table-empty error-text">فشل تحميل الطلبات</td></tr>
      `;
    });
}



// ===== Stats
function renderOrdersStats() {
  const el = document.getElementById("ordersStats");
  if (!el) return;

  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);

  let total = 0, today = 0, pending = 0, reviewing = 0, completed = 0, cancelled = 0, delayed = 0;
  let totalValue = 0, completedDurations = [];

  allOrders.forEach(o => {
    total++;

    const createdAt = tsToMs(o.createdAt);
    if (createdAt && createdAt >= todayStart.getTime()) today++;

    const st = o.status || "pending";
    if (st === "pending") pending++;
    if (st === "reviewing") reviewing++;
    if (st === "completed") completed++;
    if (st === "cancelled" || st === "rejected") cancelled++;

    const val = Number(o.estimatedTotalPrice || o.pharmacy?.estimatedTotalPrice || 0);
    totalValue += val;

    if (isDelayed(o)) delayed++;

    const comp = tsToMs(o.completedAt);
    if (createdAt && comp) {
      completedDurations.push(comp - createdAt);
    }
  });

  const avgMs = completedDurations.length
    ? Math.floor(completedDurations.reduce((a,b)=>a+b,0) / completedDurations.length)
    : 0;

  el.innerHTML = `
    ${statCard("طلبات اليوم", today)}
    ${statCard("معلقة", pending)}
    ${statCard("قيد المراجعة", reviewing)}
    ${statCard("مكتملة", completed)}
    ${statCard("ملغاة/مرفوضة", cancelled)}
    ${statCard("متأخرة", delayed, "danger")}
    ${statCard("إجمالي القيمة", formatMoney(totalValue))}
    ${statCard("متوسط الإكمال", formatDuration(avgMs))}
  `;
}

function statCard(label, value, tone="primary") {
  return `
    <div class="stat-card ${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}
function renderOrdersInsights() {
  const containerId = "ordersInsights";
  let container = document.getElementById(containerId);

  if (!container) {
    const stats = document.getElementById("ordersStats");
    container = document.createElement("div");
    container.id = containerId;
    container.className = "insights-grid";
    stats.parentNode.insertBefore(container, stats.nextSibling);
  }

  const now = Date.now();

  const pharmacyMap = {};
  const delayedList = [];
  const cancelledList = [];
  const pendingLongList = [];

  allOrders.forEach(o => {
    const pharmacyName = o.pharmacy?.pharmacyName || "غير معروف";
    const createdAt = tsToMs(o.createdAt);
    const diff = createdAt ? now - createdAt : 0;

    if (!pharmacyMap[pharmacyName]) {
      pharmacyMap[pharmacyName] = {
        total: 0,
        delayed: 0,
        cancelled: 0
      };
    }

    pharmacyMap[pharmacyName].total++;

    if (isDelayed(o)) {
      pharmacyMap[pharmacyName].delayed++;
      delayedList.push(o);
    }

    if (o.status === "cancelled" || o.status === "rejected") {
      pharmacyMap[pharmacyName].cancelled++;
      cancelledList.push(o);
    }

    if ((o.status === "pending" || o.status === "reviewing") && diff > 2 * 60 * 60 * 1000) {
      pendingLongList.push(o);
    }
  });

  // ترتيب الصيدليات الأكثر تأخير
  const topDelayedPharmacies = Object.entries(pharmacyMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.delayed - a.delayed)
    .slice(0, 5);

  container.innerHTML = `
    <div class="insight-card">
      <h3>🚨 أكثر الصيدليات تأخيرًا</h3>
      ${topDelayedPharmacies.length === 0 ? `<p>لا يوجد</p>` :
        topDelayedPharmacies.map(p => `
          <div class="insight-row">
            <span>${escapeHtml(p.name)}</span>
            <strong>${p.delayed} متأخر</strong>
          </div>
        `).join("")
      }
    </div>

    <div class="insight-card">
      <h3>⏳ طلبات عالقة طويلًا</h3>
      ${pendingLongList.length === 0 ? `<p>لا يوجد</p>` :
        pendingLongList.slice(0,5).map(o => `
          <div class="insight-row">
            <span>${escapeHtml(o.orderNumber || shortId(o.docId))}</span>
            <strong>${escapeHtml(o.pharmacy?.pharmacyName || "-")}</strong>
          </div>
        `).join("")
      }
    </div>

    <div class="insight-card">
      <h3>❌ طلبات ملغاة/مرفوضة</h3>
      ${cancelledList.length === 0 ? `<p>لا يوجد</p>` :
        cancelledList.slice(0,5).map(o => `
          <div class="insight-row">
            <span>${escapeHtml(o.orderNumber || shortId(o.docId))}</span>
            <strong>${escapeHtml(o.statusLabel || o.status)}</strong>
          </div>
        `).join("")
      }
    </div>
  `;
}
// ===== Table
function renderOrdersTable() {
  const tbody = document.getElementById("ordersTable");
  if (!tbody) return;

  const search = document.getElementById("orderSearch")?.value.trim().toLowerCase() || "";
  const filter = document.getElementById("orderStatusFilter")?.value || "all";
  const onlyDelayed = document.getElementById("onlyDelayed")?.checked;

  const filtered = allOrders.filter(o => {
    const status = o.status || "pending";
    const matchesStatus = filter === "all" || status === filter;

    const text = [
      o.orderNumber,
      o.docId,
      o.user?.name,
      o.user?.phone,
      o.beneficiary?.name,
      o.pharmacy?.pharmacyName,
      o.statusLabel,
      o.requestSourceLabel
    ].join(" ").toLowerCase();

    const delayed = isDelayed(o);

    return matchesStatus && text.includes(search) && (!onlyDelayed || delayed);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty">لا توجد طلبات</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const status = getOrderStatusInfo(o.status, o.statusLabel);
    const path = buildPath(o);
    const age = formatAge(o);
    const delayed = isDelayed(o);

    return `
      <tr class="${delayed ? "row-delayed" : ""}">
        <td>
          <div class="table-title">${escapeHtml(o.orderNumber || shortId(o.docId))}</div>
          <div class="table-subtitle">${escapeHtml(o.docId)}</div>
        </td>
        <td>${path}</td>
        <td>
          <div class="table-title">${escapeHtml(o.user?.name || "-")}</div>
          <div class="table-subtitle">${escapeHtml(o.beneficiary?.name || "-")}</div>
        </td>
        <td>${escapeHtml(o.pharmacy?.pharmacyName || "-")}</td>
        <td>${(o.totalItemsCount || (o.medicines?.length || 0))}</td>
        <td>${formatMoney(o.estimatedTotalPrice || o.pharmacy?.estimatedTotalPrice)}</td>
        <td>
          <span class="status-badge ${status.className}">${status.label}</span>
          ${delayed ? `<span class="status-badge status-rejected">متأخر</span>` : ``}
        </td>
        <td>${age}</td>
        <td>
          <button class="small-btn" onclick="openOrderModal('${o.docId}')">
            <i class="fa-solid fa-eye"></i>
            عرض
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// ===== Helpers
function buildPath(o) {
  const src = o.requestSourceLabel || o.metadata?.sourceLabel || "—";
  const st = getOrderStatusInfo(o.status, o.statusLabel).label;
  return `<span class="path-chip">${escapeHtml(src)} → ${escapeHtml(st)}</span>`;
}

function isDelayed(o) {
  const st = o.status || "pending";
  const rule = DELAY_RULES[st];
  if (!rule) return false;

  const createdAt = tsToMs(o.createdAt);
  if (!createdAt) return false;

  const now = Date.now();
  return (now - createdAt) > rule;
}

function formatAge(o) {
  const createdAt = tsToMs(o.createdAt);
  if (!createdAt) return "-";

  const diff = Date.now() - createdAt;
  if (isDelayed(o)) {
    return `<span class="age delayed">متأخر ${formatDuration(diff)}</span>`;
  }
  return `<span class="age">${formatDuration(diff)}</span>`;
}

function formatDuration(ms) {
  if (!ms) return "-";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}س ${m}د`;
  return `${m}د`;
}

function tsToMs(ts) {
  if (!ts) return null;
  try {
    return ts.seconds ? ts.seconds * 1000 : new Date(ts).getTime();
  } catch { return null; }
}

function getOrderStatusInfo(status, label) {
  const map = {
    pending: { label: "معلقة", className: "status-pending" },
    reviewing: { label: "قيد المراجعة", className: "status-pending" },
    confirmed: { label: "تم التأكيد", className: "status-approved" },
    partiallyConfirmed: { label: "متوفر جزئيًا", className: "status-pending" },
    ready: { label: "جاهز", className: "status-approved" },
    completed: { label: "مكتمل", className: "status-approved" },
    rejected: { label: "مرفوض", className: "status-rejected" },
    cancelled: { label: "ملغي", className: "status-rejected" }
  };
  return map[status] || { label: label || status || "غير معروف", className: "status-pending" };
}

function formatMoney(value) {
  const n = Number(value || 0);
  return `${n.toFixed(2)} د.ل`;
}

function shortId(id) {
  if (!id) return "-";
  return id.length > 8 ? id.substring(0, 8) : id;
}

// ===== Modal (نفس منطقك السابق)
function openOrderModal(orderId) {
  const o = allOrders.find(x => x.docId === orderId);
  if (!o) return;

  selectedOrderId = orderId;

  const status = getOrderStatusInfo(o.status, o.statusLabel);

  document.getElementById("orderModalTitle").textContent =
    `طلب ${o.orderNumber || shortId(o.docId)}`;

  document.getElementById("orderModalSubtitle").textContent =
    `${o.user?.name || "-"} • ${o.pharmacy?.pharmacyName || "-"} • ${status.label}`;

  document.getElementById("orderSummaryGrid").innerHTML = `
    ${detailItem("معرف الطلب", o.docId)}
    ${detailItem("حالة الطلب", status.label)}
    ${detailItem("المستخدم", o.user?.name)}
    ${detailItem("هاتف المستخدم", o.user?.phone)}
    ${detailItem("المستفيد", o.beneficiary?.name)}
    ${detailItem("نوع المستفيد", o.beneficiary?.typeLabel || o.beneficiary?.relationLabel)}
    ${detailItem("الصيدلية", o.pharmacy?.pharmacyName)}
    ${detailItem("هاتف الصيدلية", o.pharmacy?.phoneNumber)}
    ${detailItem("عنوان الصيدلية", o.pharmacy?.address)}
    ${detailItem("مصدر الطلب", o.requestSourceLabel || o.metadata?.sourceLabel)}
    ${detailItem("عدد الأدوية", o.totalItemsCount || (Array.isArray(o.medicines) ? o.medicines.length : 0))}
    ${detailItem("السعر التقديري", formatMoney(o.estimatedTotalPrice || o.pharmacy?.estimatedTotalPrice))}
    ${detailItem("تاريخ الإنشاء", formatTimestamp(o.createdAt))}
    ${detailItem("وقت المراجعة", formatTimestamp(o.reviewedAt))}
    ${detailItem("وقت الإكمال", formatTimestamp(o.completedAt))}
  `;

  renderOrderMedicines(o.medicines || []);
  renderOrderTimeline(o.statusHistory || []);

  document.getElementById("orderModal").classList.remove("hidden");
}

function closeOrderModal() {
  selectedOrderId = null;
  document.getElementById("orderModal").classList.add("hidden");
}

function renderOrderMedicines(medicines) {
  const container = document.getElementById("orderMedicinesList");

  if (!Array.isArray(medicines) || medicines.length === 0) {
    container.innerHTML = `<div class="empty-state">لا توجد أدوية</div>`;
    return;
  }

  container.innerHTML = medicines.map((m, i) => `
    <div class="medicine-row">
      <div class="medicine-index">${i + 1}</div>
      <div class="medicine-info">
        <strong>${escapeHtml(m.requestedName || "-")}</strong>
        <span>المطابق: ${escapeHtml(m.matchedMedicineName || "-")}</span>
      </div>
      <div class="medicine-meta">
        <span>الكمية: ${escapeHtml(m.quantity || 1)}</span>
        <span>${formatMoney(m.estimatedPrice)}</span>
      </div>
    </div>
  `).join("");
}

function renderOrderTimeline(history) {
  const container = document.getElementById("orderStatusTimeline");

  if (!Array.isArray(history) || history.length === 0) {
    container.innerHTML = `<div class="empty-state">لا يوجد سجل</div>`;
    return;
  }

  container.innerHTML = history.map(item => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div>
        <strong>${escapeHtml(item.label || item.status || "-")}</strong>
        <p>${formatTimestamp(item.changedAt)} • ${escapeHtml(item.changedByType || "-")}</p>
        ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
      </div>
    </div>
  `).join("");
}