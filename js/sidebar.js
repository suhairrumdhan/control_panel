const pageTitle = document.getElementById("pageTitle");
const contentArea = document.getElementById("contentArea");

document.querySelectorAll(".menu-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".menu-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");

    const page = item.dataset.page;
    openPage(page);
  });
});

function openPage(page) {
  const titles = {
    dashboard: "الرئيسية",
    requests: "طلبات تسجيل الصيدليات",
    pharmacies: "الصيدليات",
    users: "المستخدمون",
    alerts: "التنبيهات والإنذارات",
    notifications: "الإشعارات الجماعية",
    reports: "التقارير والإحصائيات"
  };

  pageTitle.textContent = titles[page] || "الرئيسية";

if (page === "dashboard") {
  renderDashboard();
  return;
}

if (page === "requests") {
  renderPharmacyRequestsPage();
  return;
}
if (page === "pharmacies") {
  renderPharmaciesPage();
  return;
}
if (page === "orders") {
  renderOrdersPage();
  return;
}

  contentArea.innerHTML = `
    <div class="panel-card">
      <h2>${titles[page]}</h2>
      <div class="empty-state">
        سيتم تنفيذ هذه الصفحة في الخطوة التالية.
      </div>
    </div>
  `;
}