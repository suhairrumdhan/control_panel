const pageTitle = document.getElementById("pageTitle");
const contentArea = document.getElementById("contentArea");
const sidebar = document.getElementById("sidebar");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");

mobileMenuBtn?.addEventListener("click", () => appShell.classList.toggle("sidebar-open") || sidebar.classList.toggle("open"));
appShell?.addEventListener("click", (e) => {
  if (appShell.classList.contains("sidebar-open") && !sidebar.contains(e.target) && e.target !== mobileMenuBtn) {
    appShell.classList.remove("sidebar-open"); sidebar.classList.remove("open");
  }
});

document.querySelectorAll(".menu-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".menu-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    openPage(item.dataset.page);
    appShell.classList.remove("sidebar-open"); sidebar.classList.remove("open");
  });
});

function openPage(page) {
  const titles = {
    dashboard: "الرئيسية", requests: "طلبات تسجيل الصيدليات", pharmacies: "الصيدليات",
    orders: "الطلبات", users: "المستخدمون", alerts: "التنبيهات والإنذارات",
    notifications: "الإشعارات الجماعية", reports: "التقارير والإحصائيات",audit: "سجل العمليات",
  };
  pageTitle.textContent = titles[page] || "الرئيسية";
  if (page === "dashboard") return renderDashboard();
  if (page === "requests") return renderPharmacyRequestsPage();
  if (page === "pharmacies") return renderPharmaciesPage();
  if (page === "orders") return renderOrdersPage();
  if (page === "users") {
  renderUsersPage();
  return;
}
if (page === "alerts") {
  renderAlertsPage();
  return;
}
if (page === "notifications") {
  renderNotificationsPage();
  return;
}
if (page === "reports") {
  renderReportsPage();
  return;
}

if (page === "audit") {
  renderAuditLogsPage();
  return;
}


  contentArea.innerHTML = `<div class="panel-card"><h2>${titles[page]}</h2><div class="empty-state">سيتم تنفيذ هذه الصفحة في الخطوة التالية.</div></div>`;
}
