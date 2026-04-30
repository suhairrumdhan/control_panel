let requestsUnsubscribe = null;
let allPharmacyRequests = [];
let selectedRequestId = null;

function renderPharmacyRequestsPage() {
  contentArea.innerHTML = `
    <div class="panel-card">
      <div class="section-toolbar">
        <div>
          <h2>طلبات تسجيل الصيدليات</h2>
          <p>مراجعة، قبول، أو رفض طلبات الانضمام للنظام.</p>
        </div>

        <div class="toolbar-actions">
          <input id="requestSearchInput" class="search-input" placeholder="بحث باسم الصيدلية أو المالك أو الترخيص">
          <select id="requestStatusFilter" class="filter-select">
            <option value="all">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="approved">معتمدة</option>
            <option value="rejected">مرفوضة</option>
          </select>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>الصيدلية</th>
              <th>المالك</th>
              <th>رقم الترخيص</th>
              <th>تاريخ الطلب</th>
              <th>الحالة</th>
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody id="requestsTableBody">
            <tr>
              <td colspan="6" class="table-empty">جاري تحميل الطلبات...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="requestModal" class="modal-overlay hidden">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h2>تفاصيل طلب التسجيل</h2>
            <p id="modalSubtitle">-</p>
          </div>
          <button class="icon-btn" onclick="closeRequestModal()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div id="requestDetailsGrid" class="details-grid"></div>

        <div class="documents-grid">
          <div class="document-card">
            <h3>صورة الترخيص</h3>
            <div id="licensePreview" class="image-preview">لا توجد صورة</div>
          </div>

          <div class="document-card">
            <h3>صورة الهوية</h3>
            <div id="ownerIdPreview" class="image-preview">لا توجد صورة</div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="danger-btn" onclick="rejectSelectedRequest()">
            <i class="fa-solid fa-xmark"></i>
            رفض الطلب
          </button>

          <button class="success-btn" onclick="approveSelectedRequest()">
            <i class="fa-solid fa-check"></i>
            الموافقة على الطلب
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("requestSearchInput").addEventListener("input", renderRequestsTable);
  document.getElementById("requestStatusFilter").addEventListener("change", renderRequestsTable);

  listenPharmacyRequests();
}

function listenPharmacyRequests() {
  if (requestsUnsubscribe) requestsUnsubscribe();

  requestsUnsubscribe = db.collection("pharmacyRequests")
    .orderBy("requestDate", "desc")
    .onSnapshot((snapshot) => {
      allPharmacyRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      renderRequestsTable();
    }, (error) => {
      console.error(error);
      document.getElementById("requestsTableBody").innerHTML = `
        <tr>
          <td colspan="6" class="table-empty error-text">فشل تحميل الطلبات</td>
        </tr>
      `;
    });
}

function renderRequestsTable() {
  const tbody = document.getElementById("requestsTableBody");
  if (!tbody) return;

  const search = document.getElementById("requestSearchInput")?.value.trim().toLowerCase() || "";
  const statusFilter = document.getElementById("requestStatusFilter")?.value || "all";

  const filtered = allPharmacyRequests.filter((request) => {
    const status = request.status || "pending";

    const matchesStatus = statusFilter === "all" || status === statusFilter;

    const text = [
      request.pharmacyName,
      request.ownerName,
      request.licenseNumber,
      request.email,
      request.phoneNumber
    ].join(" ").toLowerCase();

    return matchesStatus && text.includes(search);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">لا توجد طلبات مطابقة</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(request => {
    const status = getRequestStatus(request.status);
    return `
      <tr>
        <td>
          <div class="table-title">${escapeHtml(request.pharmacyName || "-")}</div>
          <div class="table-subtitle">${escapeHtml(request.email || "-")}</div>
        </td>
        <td>${escapeHtml(request.ownerName || "-")}</td>
        <td>${escapeHtml(request.licenseNumber || "-")}</td>
        <td>${formatTimestamp(request.requestDate || request.createdAt)}</td>
        <td><span class="status-badge ${status.className}">${status.label}</span></td>
        <td>
          <button class="small-btn" onclick="openRequestModal('${request.id}')">
            <i class="fa-solid fa-eye"></i>
            عرض
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function openRequestModal(requestId) {
  const request = allPharmacyRequests.find(r => r.id === requestId);
  if (!request) return;

  selectedRequestId = requestId;

  const status = getRequestStatus(request.status);
  const address = request.location?.address || request.address || "-";
  const serviceType = [
    request.is24Hours ? "24 ساعة" : null,
    request.isOnline ? "أونلاين" : null
  ].filter(Boolean).join(" - ") || "عادي";

  document.getElementById("modalSubtitle").textContent =
    `${request.pharmacyName || "-"} • ${status.label}`;

  document.getElementById("requestDetailsGrid").innerHTML = `
    ${detailItem("اسم الصيدلية", request.pharmacyName)}
    ${detailItem("اسم المالك", request.ownerName)}
    ${detailItem("البريد الإلكتروني", request.email)}
    ${detailItem("رقم الهاتف", request.phoneNumber)}
    ${detailItem("رقم الهوية", request.ownerIdNumber)}
    ${detailItem("رقم الترخيص", request.licenseNumber)}
    ${detailItem("العنوان", address)}
    ${detailItem("نوع الخدمة", serviceType)}
    ${detailItem("تاريخ الطلب", formatTimestamp(request.requestDate || request.createdAt))}
    ${detailItem("آخر تحديث", formatTimestamp(request.updatedAt))}
  `;

  setImagePreview("licensePreview", request.licenseFileUrl);
  setImagePreview("ownerIdPreview", request.ownerIdFileUrl);

  document.getElementById("requestModal").classList.remove("hidden");
}

function closeRequestModal() {
  selectedRequestId = null;
  document.getElementById("requestModal").classList.add("hidden");
}

async function approveSelectedRequest() {
  if (!selectedRequestId || !currentUser) return;

  const request = allPharmacyRequests.find(r => r.id === selectedRequestId);
  if (!request) return;

  const ok = confirm("هل أنتِ متأكدة من الموافقة على هذا الطلب وتفعيل الصيدلية؟");
  if (!ok) return;

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const pharmacyId = selectedRequestId;

    const pharmacyData = {
      id: pharmacyId,

      pharmacyName: request.pharmacyName || "",
      ownerName: request.ownerName || "",
      ownerIdNumber: request.ownerIdNumber || "",
      email: request.email || "",
      phoneNumber: request.phoneNumber || "",

      licenseNumber: request.licenseNumber || "",
      licenseFileUrl: request.licenseFileUrl || "",
      ownerIdFileUrl: request.ownerIdFileUrl || "",
      imageUrl: request.imageUrl || "",

      location: request.location || {
        address: request.address || "",
        latitude: null,
        longitude: null
      },

      locationCoordinates: request.locationCoordinates || null,

      status: "approved",
      isOnline: request.isOnline ?? false,
      is24Hours: request.is24Hours ?? false,

      acceptedInsuranceCodes: request.acceptedInsuranceCodes || [],
      categories: request.categories || [],

      approvedBy: currentUser.email || currentUser.uid,
      approvedDate: now,

      createdAt: request.createdAt || now,
      updatedAt: now,
      lastStatusUpdate: now
    };

    const batch = db.batch();

    const requestRef = db.collection("pharmacyRequests").doc(pharmacyId);
    const pharmacyRef = db.collection("pharmacies").doc(pharmacyId);

    const settingsRef = db
      .collection("pharmacies")
      .doc(pharmacyId)
      .collection("settings")
      .doc("general");

    const auditRef = db.collection("adminAuditLogs").doc();
    const notificationRef = db.collection("pharmacyAdminNotifications").doc();

    batch.update(requestRef, {
      status: "approved",
      approvedBy: currentUser.email || currentUser.uid,
      approvedDate: now,
      updatedAt: now
    });

    batch.set(pharmacyRef, pharmacyData, { merge: true });

    batch.set(settingsRef, {
      is24Hours: request.is24Hours ?? false,
      isOnline: request.isOnline ?? false,
      notificationsEnabled: true,
      createdAt: now,
      updatedAt: now
    }, { merge: true });

    batch.set(auditRef, {
      action: "approve_pharmacy_request",
      module: "pharmacy_requests",
      targetType: "pharmacy",
      targetId: pharmacyId,
      targetName: request.pharmacyName || "-",
      status: "success",
      performedBy: {
        uid: currentUser.uid,
        email: currentUser.email || "",
        name: currentUser.displayName || "Admin"
      },
      createdAt: now,
      source: "admin_panel_web"
    });

    batch.set(notificationRef, {
      pharmacyId: pharmacyId,
      ownerEmail: request.email || "",
      title: "تمت الموافقة على طلب الصيدلية",
      body: "يمكنك الآن تسجيل الدخول إلى تطبيق الصيدلية والبدء في استخدام النظام.",
      type: "pharmacy_approval",
      status: "unread",
      createdAt: now,
      targetRoute: "/login",
      source: "admin_panel_web"
    });

    await batch.commit();

    closeRequestModal();
    alert("تمت الموافقة وتفعيل الصيدلية بنجاح");
  } catch (error) {
    console.error("Approve pharmacy request error:", error);
    alert("حدث خطأ أثناء الموافقة على الطلب");
  }
}

async function rejectSelectedRequest() {
  if (!selectedRequestId || !currentUser) return;

  const request = allPharmacyRequests.find(r => r.id === selectedRequestId);
  if (!request) return;

  const reason = prompt("اكتبي سبب الرفض:");
  if (reason === null) return;

  const rejectionReason = reason.trim();

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();

    const batch = db.batch();

    const requestRef = db.collection("pharmacyRequests").doc(selectedRequestId);
    const auditRef = db.collection("adminAuditLogs").doc();
    const notificationRef = db.collection("pharmacyAdminNotifications").doc();

    batch.update(requestRef, {
      status: "rejected",
      rejectionReason: rejectionReason,
      rejectedBy: currentUser.email || currentUser.uid,
      rejectedDate: now,
      updatedAt: now
    });

    batch.set(auditRef, {
      action: "reject_pharmacy_request",
      module: "pharmacy_requests",
      targetType: "pharmacy_request",
      targetId: selectedRequestId,
      targetName: request.pharmacyName || "-",
      status: "success",
      reason: rejectionReason,
      performedBy: {
        uid: currentUser.uid,
        email: currentUser.email || "",
        name: currentUser.displayName || "Admin"
      },
      createdAt: now,
      source: "admin_panel_web"
    });

    batch.set(notificationRef, {
      pharmacyId: selectedRequestId,
      ownerEmail: request.email || "",
      title: "تم رفض طلب تسجيل الصيدلية",
      body: rejectionReason || "يرجى التواصل مع الإدارة لمعرفة التفاصيل.",
      type: "pharmacy_rejection",
      status: "unread",
      createdAt: now,
      targetRoute: "/waiting-approval",
      source: "admin_panel_web"
    });

    await batch.commit();

    closeRequestModal();
    alert("تم رفض الطلب بنجاح");
  } catch (error) {
    console.error("Reject pharmacy request error:", error);
    alert("حدث خطأ أثناء رفض الطلب");
  }
}

async function createAuditLog(data) {
  await db.collection("adminAuditLogs").add({
    ...data,
    performedBy: {
      uid: currentUser?.uid || null,
      email: currentUser?.email || null,
      name: currentUser?.displayName || "Admin"
    },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    source: "admin_panel_web"
  });
}

function getRequestStatus(status) {
  if (status === "approved") {
    return { label: "معتمد", className: "status-approved" };
  }

  if (status === "rejected") {
    return { label: "مرفوض", className: "status-rejected" };
  }

  return { label: "قيد الانتظار", className: "status-pending" };
}

function detailItem(label, value) {
  return `
    <div class="detail-item">
      <span>${label}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function setImagePreview(containerId, url) {
  const container = document.getElementById(containerId);

  if (!url) {
    container.innerHTML = "لا توجد صورة";
    return;
  }

  container.innerHTML = `
    <a href="${url}" target="_blank">
      <img src="${url}" alt="document image">
    </a>
  `;
}

function formatTimestamp(ts) {
  if (!ts) return "-";

  try {
    const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);

    return date.toLocaleString("ar-LY", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (_) {
    return "-";
  }
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "-";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}