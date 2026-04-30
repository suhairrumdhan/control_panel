let dashboardUnsubscribe = null;

function renderDashboard() {
  contentArea.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <i class="fa-solid fa-clock"></i>
        <h3 id="pendingCount">0</h3>
        <p>طلبات قيد الانتظار</p>
      </div>

      <div class="stat-card">
        <i class="fa-solid fa-circle-check"></i>
        <h3 id="approvedCount">0</h3>
        <p>صيدليات معتمدة</p>
      </div>

      <div class="stat-card">
        <i class="fa-solid fa-ban"></i>
        <h3 id="rejectedCount">0</h3>
        <p>طلبات مرفوضة</p>
      </div>

      <div class="stat-card">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h3 id="alertsCount">0</h3>
        <p>تنبيهات تحتاج مراجعة</p>
      </div>
    </div>

    <div class="panel-card">
      <h2>ملخص النظام</h2>
      <div class="empty-state">
        لوحة التحكم جاهزة. الخطوة التالية: تنفيذ صفحة طلبات تسجيل الصيدليات.
      </div>
    </div>
  `;
}

function listenDashboardStats() {
  if (dashboardUnsubscribe) dashboardUnsubscribe();

  dashboardUnsubscribe = db.collection("pharmacyRequests")
    .onSnapshot((snapshot) => {
      let pending = 0;
      let approved = 0;
      let rejected = 0;

      snapshot.forEach((doc) => {
        const status = doc.data().status || "pending";
        if (status === "approved") approved++;
        else if (status === "rejected") rejected++;
        else pending++;
      });

      setText("pendingCount", pending);
      setText("approvedCount", approved);
      setText("rejectedCount", rejected);
      setText("pendingBadge", pending);
    });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}