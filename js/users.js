let usersUnsubscribe = null;
let allUsers = [];
let selectedUserId = null;

function renderUsersPage() {
  contentArea.innerHTML = `
    <div class="panel-card">
      <div class="section-toolbar">
        <div>
          <h2>إدارة المستخدمين</h2>
          <p>عرض ومراقبة حسابات المستخدمين والمستفيدين داخل النظام.</p>
        </div>

        <div class="toolbar-actions">
          <input id="userSearchInput" class="search-input" placeholder="بحث بالاسم، البريد، أو الهاتف">
          <select id="userStatusFilter" class="filter-select">
            <option value="all">كل المستخدمين</option>
            <option value="active">نشط</option>
            <option value="blocked">محظور</option>
            <option value="hasFamily">لديه أفراد عائلة</option>
            <option value="hasInsurance">لديه تأمين</option>
          </select>
        </div>
      </div>

      <div id="usersStats" class="stats-grid"></div>

      <div class="table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الهاتف</th>
              <th>الجنس</th>
              <th>العائلة</th>
              <th>التأمين</th>
              <th>الحالة</th>
              <th>تاريخ التسجيل</th>
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
            <tr>
              <td colspan="8" class="table-empty">جاري تحميل المستخدمين...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="userModal" class="modal-overlay hidden">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h2 id="userModalTitle">تفاصيل المستخدم</h2>
            <p id="userModalSubtitle">-</p>
          </div>
          <button class="icon-btn" onclick="closeUserModal()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div id="userDetailsGrid" class="details-grid"></div>

        <div class="panel-card inner-panel">
          <h2>أفراد العائلة</h2>
          <div id="userFamilyList" class="mini-list"></div>
        </div>

        <div class="panel-card inner-panel">
          <h2>التأمين الصحي</h2>
          <div id="userInsuranceList" class="mini-list"></div>
        </div>

        <div class="panel-card inner-panel">
          <h2>آخر الطلبات</h2>
          <div id="userOrdersList" class="mini-list"></div>
        </div>

        <div class="modal-actions">
          <button id="toggleUserBlockBtn" class="danger-btn" onclick="toggleSelectedUserBlock()">
            <i class="fa-solid fa-ban"></i>
            حظر المستخدم
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("userSearchInput").addEventListener("input", renderUsersTable);
  document.getElementById("userStatusFilter").addEventListener("change", renderUsersTable);

  listenUsers();
}

function listenUsers() {
  if (usersUnsubscribe) usersUnsubscribe();

  usersUnsubscribe = db.collection("users")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      allUsers = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));

      renderUsersStats();
      renderUsersTable();
    }, (error) => {
      console.error("Load users error:", error);
      document.getElementById("usersTableBody").innerHTML = `
        <tr>
          <td colspan="8" class="table-empty error-text">فشل تحميل المستخدمين</td>
        </tr>
      `;
    });
}

function renderUsersStats() {
  const el = document.getElementById("usersStats");
  if (!el) return;

  const total = allUsers.length;
  const blocked = allUsers.filter(u => isUserBlocked(u)).length;
  const active = total - blocked;
  const withFamily = allUsers.filter(u => Number(u.familyMembersCount || 0) > 0).length;
  const withInsurance = allUsers.filter(u => Number(u.insurancesCount || 0) > 0).length;

  el.innerHTML = `
    ${userStatCard("إجمالي المستخدمين", total, "fa-users")}
    ${userStatCard("نشطون", active, "fa-user-check")}
    ${userStatCard("محظورون", blocked, "fa-user-lock", "danger")}
    ${userStatCard("لديهم أفراد عائلة", withFamily, "fa-people-roof")}
    ${userStatCard("لديهم تأمين", withInsurance, "fa-shield-heart")}
  `;
}

function userStatCard(label, value, icon, tone = "primary") {
  return `
    <div class="stat-card ${tone}">
      <i class="fa-solid ${icon}"></i>
      <h3>${value}</h3>
      <p>${label}</p>
    </div>
  `;
}

function renderUsersTable() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  const search = document.getElementById("userSearchInput")?.value.trim().toLowerCase() || "";
  const filter = document.getElementById("userStatusFilter")?.value || "all";

  const filtered = allUsers.filter((user) => {
    const blocked = isUserBlocked(user);

    let matchesFilter = true;
    if (filter === "active") matchesFilter = !blocked;
    if (filter === "blocked") matchesFilter = blocked;
    if (filter === "hasFamily") matchesFilter = Number(user.familyMembersCount || 0) > 0;
    if (filter === "hasInsurance") matchesFilter = Number(user.insurancesCount || 0) > 0;

    const text = [
      user.name,
      user.Name,
      user.email,
      user.Email,
      user.phone,
      user.Phone,
      user.docId
    ].join(" ").toLowerCase();

    return matchesFilter && text.includes(search);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="table-empty">لا يوجد مستخدمون مطابقون</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(user => {
    const blocked = isUserBlocked(user);
    const statusClass = blocked ? "status-rejected" : "status-approved";
    const statusLabel = blocked ? "محظور" : "نشط";

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-avatar">${getUserInitial(user)}</div>
            <div>
              <div class="table-title">${escapeHtml(getUserName(user))}</div>
              <div class="table-subtitle">${escapeHtml(getUserEmail(user))}</div>
            </div>
          </div>
        </td>

        <td>${escapeHtml(getUserPhone(user))}</td>
        <td>${escapeHtml(user.gender || user.Gender || "-")}</td>
        <td>${Number(user.familyMembersCount || 0)}</td>
        <td>${Number(user.insurancesCount || 0)}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td>${formatTimestamp(user.createdAt)}</td>
        <td>
          <button class="small-btn" onclick="openUserModal('${user.docId}')">
            <i class="fa-solid fa-eye"></i>
            عرض
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

async function openUserModal(userId) {
  const user = allUsers.find(u => u.docId === userId);
  if (!user) return;

  selectedUserId = userId;

  const blocked = isUserBlocked(user);

  document.getElementById("userModalTitle").textContent = getUserName(user);
  document.getElementById("userModalSubtitle").textContent = getUserEmail(user);

  document.getElementById("userDetailsGrid").innerHTML = `
    ${detailItem("معرف المستخدم", user.docId)}
    ${detailItem("الاسم", getUserName(user))}
    ${detailItem("البريد الإلكتروني", getUserEmail(user))}
    ${detailItem("رقم الهاتف", getUserPhone(user))}
    ${detailItem("الجنس", user.gender || user.Gender)}
    ${detailItem("تاريخ الميلاد", formatTimestamp(user.dateOfBirth || user.DateOfBirth))}
    ${detailItem("فصيلة الدم", user.bloodType || user.BloodType)}
    ${detailItem("الحساسيات", formatArray(user.allergies))}
    ${detailItem("الأمراض المزمنة", formatArray(user.healthConditions))}
    ${detailItem("الأدوية الحالية", formatArray(user.currentMedications))}
    ${detailItem("الحالة", blocked ? "محظور" : "نشط")}
    ${detailItem("تاريخ التسجيل", formatTimestamp(user.createdAt))}
    ${detailItem("آخر تحديث", formatTimestamp(user.updatedAt))}
  `;

  const toggleBtn = document.getElementById("toggleUserBlockBtn");
  toggleBtn.innerHTML = blocked
    ? `<i class="fa-solid fa-unlock"></i> فك الحظر`
    : `<i class="fa-solid fa-ban"></i> حظر المستخدم`;

  toggleBtn.className = blocked ? "success-btn" : "danger-btn";

  document.getElementById("userModal").classList.remove("hidden");

  await loadUserExtraData(userId);
}

async function loadUserExtraData(userId) {
  await Promise.all([
    loadUserFamily(userId),
    loadUserInsurances(userId),
    loadUserOrders(userId)
  ]);
}

async function loadUserFamily(userId) {
  const container = document.getElementById("userFamilyList");
  if (!container) return;

  container.innerHTML = `<div class="empty-state">جاري تحميل أفراد العائلة...</div>`;

  try {
    const snapshot = await db.collection("users")
      .doc(userId)
      .collection("familyMembers")
      .orderBy("createdAt", "desc")
      .get();

    if (snapshot.empty) {
      container.innerHTML = `<div class="empty-state">لا يوجد أفراد عائلة</div>`;
      return;
    }

    container.innerHTML = snapshot.docs.map(doc => {
      const m = doc.data();
      return `
        <div class="mini-row">
          <div>
            <strong>${escapeHtml(m.name || m.Name || "-")}</strong>
            <span>${escapeHtml(m.relation || "-")}</span>
          </div>
          <b>${escapeHtml(m.gender || m.Gender || "-")}</b>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Load family error:", error);
    container.innerHTML = `<div class="empty-state error-text">فشل تحميل أفراد العائلة</div>`;
  }
}

async function loadUserInsurances(userId) {
  const container = document.getElementById("userInsuranceList");
  if (!container) return;

  container.innerHTML = `<div class="empty-state">جاري تحميل التأمين...</div>`;

  try {
    const snapshot = await db.collection("users")
      .doc(userId)
      .collection("insurances")
      .orderBy("createdAt", "desc")
      .get();

    if (snapshot.empty) {
      container.innerHTML = `<div class="empty-state">لا يوجد تأمين صحي</div>`;
      return;
    }

    container.innerHTML = snapshot.docs.map(doc => {
      const i = doc.data();
      return `
        <div class="mini-row">
          <div>
            <strong>${escapeHtml(i.companyName || "-")}</strong>
            <span>${escapeHtml(i.cardNumber || "-")}</span>
          </div>
          <b>${escapeHtml(i.companyCode || "-")}</b>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Load insurances error:", error);
    container.innerHTML = `<div class="empty-state error-text">فشل تحميل التأمين</div>`;
  }
}

async function loadUserOrders(userId) {
  const container = document.getElementById("userOrdersList");
  if (!container) return;

  container.innerHTML = `<div class="empty-state">جاري تحميل الطلبات...</div>`;

  try {
    const snapshot = await db.collection("orders")
      .where("user.userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    if (snapshot.empty) {
      container.innerHTML = `<div class="empty-state">لا توجد طلبات لهذا المستخدم</div>`;
      return;
    }

    container.innerHTML = snapshot.docs.map(doc => {
      const o = doc.data();
      const st = getUserOrderStatus(o.status, o.statusLabel);

      return `
        <div class="mini-row">
          <div>
            <strong>${escapeHtml(o.orderNumber || doc.id)}</strong>
            <span>${escapeHtml(o.pharmacy?.pharmacyName || "-")} • ${formatTimestamp(o.createdAt)}</span>
          </div>
          <b class="status-badge ${st.className}">${st.label}</b>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Load user orders error:", error);
    container.innerHTML = `<div class="empty-state error-text">فشل تحميل الطلبات</div>`;
  }
}

function closeUserModal() {
  selectedUserId = null;
  document.getElementById("userModal").classList.add("hidden");
}

async function toggleSelectedUserBlock() {
  if (!selectedUserId || !currentUser) return;

  const user = allUsers.find(u => u.docId === selectedUserId);
  if (!user) return;

  const blocked = isUserBlocked(user);
  const nextBlocked = !blocked;

  const ok = confirm(nextBlocked
    ? "هل أنتِ متأكدة من حظر هذا المستخدم؟"
    : "هل أنتِ متأكدة من فك الحظر عن هذا المستخدم؟"
  );

  if (!ok) return;

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();

    const batch = db.batch();

    const userRef = db.collection("users").doc(selectedUserId);
    const auditRef = db.collection("adminAuditLogs").doc();

    batch.update(userRef, {
      isBlocked: nextBlocked,
      status: nextBlocked ? "blocked" : "active",
      updatedAt: now,
      lastStatusUpdate: now,
      blockedBy: nextBlocked ? (currentUser.email || currentUser.uid) : null,
      blockedDate: nextBlocked ? now : null
    });

    batch.set(auditRef, {
      action: nextBlocked ? "block_user" : "unblock_user",
      module: "users",
      targetType: "user",
      targetId: selectedUserId,
      targetName: getUserName(user),
      status: "success",
      performedBy: {
        uid: currentUser.uid,
        email: currentUser.email || "",
        name: currentUser.displayName || "Admin"
      },
      createdAt: now,
      source: "admin_panel_web"
    });

    await batch.commit();

    closeUserModal();
    alert(nextBlocked ? "تم حظر المستخدم" : "تم فك الحظر عن المستخدم");
  } catch (error) {
    console.error("Toggle user block error:", error);
    alert("حدث خطأ أثناء تحديث حالة المستخدم");
  }
}

function isUserBlocked(user) {
  return user.isBlocked === true || user.status === "blocked";
}

function getUserName(user) {
  return user.name || user.Name || "مستخدم";
}

function getUserEmail(user) {
  return user.email || user.Email || "-";
}

function getUserPhone(user) {
  return user.phone || user.Phone || "-";
}

function getUserInitial(user) {
  const name = getUserName(user);
  return escapeHtml(name.trim().charAt(0) || "م");
}

function getUserOrderStatus(status, label) {
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