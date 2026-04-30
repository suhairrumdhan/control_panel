let pharmaciesUnsubscribe = null;
let allPharmacies = [];
let selectedPharmacyId = null;

function renderPharmaciesPage() {
  contentArea.innerHTML = `
    <div class="panel-card">
      <div class="section-toolbar">
        <div>
          <h2>الصيدليات</h2>
          <p>عرض ومراقبة الصيدليات المعتمدة داخل النظام.</p>
        </div>

        <div class="toolbar-actions">
          <input id="pharmacySearchInput" class="search-input" placeholder="بحث باسم الصيدلية أو المالك أو الهاتف">
          <select id="pharmacyStatusFilter" class="filter-select">
            <option value="all">كل الحالات</option>
            <option value="approved">معتمدة</option>
            <option value="blocked">محظورة</option>
            <option value="online">أونلاين</option>
            <option value="offline">أوفلاين</option>
            <option value="24h">24 ساعة</option>
          </select>
        </div>
      </div>

      <div id="pharmaciesGrid" class="pharmacies-grid">
        <div class="empty-state">جاري تحميل الصيدليات...</div>
      </div>
    </div>

    <div id="pharmacyModal" class="modal-overlay hidden">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h2 id="pharmacyModalTitle">تفاصيل الصيدلية</h2>
            <p id="pharmacyModalSubtitle">-</p>
          </div>
          <button class="icon-btn" onclick="closePharmacyModal()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div id="pharmacyDetailsGrid" class="details-grid"></div>
        <div class="documents-grid">
        <div class="document-card">
            <h3>شعار الصيدلية</h3>
            <div id="pharmacyLogoPreview" class="image-preview">لا توجد صورة</div>
        </div>

        <div class="document-card">
            <h3>صورة الترخيص</h3>
            <div id="pharmacyLicensePreview" class="image-preview">لا توجد صورة</div>
        </div>

        <div class="document-card">
            <h3>هوية المالك</h3>
            <div id="pharmacyOwnerIdPreview" class="image-preview">لا توجد صورة</div>
        </div>
        </div>

        <div class="modal-actions">
          <button id="toggleBlockBtn" class="danger-btn" onclick="toggleSelectedPharmacyBlock()">
            <i class="fa-solid fa-ban"></i>
            حظر الصيدلية
          </button>

          <button class="small-btn" onclick="openPharmacyLocation()">
            <i class="fa-solid fa-location-dot"></i>
            فتح الموقع
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("pharmacySearchInput").addEventListener("input", renderPharmaciesGrid);
  document.getElementById("pharmacyStatusFilter").addEventListener("change", renderPharmaciesGrid);

  listenPharmacies();
}

function listenPharmacies() {
  if (pharmaciesUnsubscribe) pharmaciesUnsubscribe();

  pharmaciesUnsubscribe = db.collection("pharmacies")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      allPharmacies = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));

      renderPharmaciesGrid();
    }, (error) => {
      console.error("Load pharmacies error:", error);
      document.getElementById("pharmaciesGrid").innerHTML = `
        <div class="empty-state error-text">فشل تحميل الصيدليات</div>
      `;
    });
}

function renderPharmaciesGrid() {
  const grid = document.getElementById("pharmaciesGrid");
  if (!grid) return;

  const search = document.getElementById("pharmacySearchInput")?.value.trim().toLowerCase() || "";
  const filter = document.getElementById("pharmacyStatusFilter")?.value || "all";

  const filtered = allPharmacies.filter((p) => {
    const isBlocked = p.isBlocked === true || p.status === "blocked";
    const isOnline = p.isOnline === true;
    const is24Hours = p.is24Hours === true;

    let matchesFilter = true;

    if (filter === "approved") matchesFilter = p.status === "approved" && !isBlocked;
    if (filter === "blocked") matchesFilter = isBlocked;
    if (filter === "online") matchesFilter = isOnline;
    if (filter === "offline") matchesFilter = !isOnline;
    if (filter === "24h") matchesFilter = is24Hours;

    const text = [
      p.pharmacyName,
      p.ownerName,
      p.email,
      p.phoneNumber,
      p.licenseNumber,
      p.location?.address
    ].join(" ").toLowerCase();

    return matchesFilter && text.includes(search);
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">لا توجد صيدليات مطابقة</div>`;
    return;
  }

  grid.innerHTML = filtered.map((p) => {
    const isBlocked = p.isBlocked === true || p.status === "blocked";
    const statusClass = isBlocked ? "status-rejected" : "status-approved";
    const statusLabel = isBlocked ? "محظورة" : "معتمدة";

    const onlineClass = p.isOnline ? "status-approved" : "status-pending";
    const onlineLabel = p.isOnline ? "أونلاين" : "أوفلاين";

    const logo = p.imageUrl
      ? `<img src="${p.imageUrl}" alt="pharmacy logo">`
      : `<i class="fa-solid fa-house-medical"></i>`;

    return `
      <div class="pharmacy-card">
        <div class="pharmacy-card-header">
          <div class="pharmacy-avatar">${logo}</div>
          <div>
            <h3>${escapeHtml(p.pharmacyName || "-")}</h3>
            <p>${escapeHtml(p.location?.address || "-")}</p>
          </div>
        </div>

        <div class="pharmacy-badges">
          <span class="status-badge ${statusClass}">${statusLabel}</span>
          <span class="status-badge ${onlineClass}">${onlineLabel}</span>
          ${p.is24Hours ? `<span class="status-badge status-approved">24 ساعة</span>` : ""}
        </div>

        <div class="pharmacy-meta">
          <div>
            <span>المالك</span>
            <strong>${escapeHtml(p.ownerName || "-")}</strong>
          </div>
          <div>
            <span>الهاتف</span>
            <strong>${escapeHtml(p.phoneNumber || "-")}</strong>
          </div>
          <div>
            <span>التأمينات</span>
            <strong>${Array.isArray(p.acceptedInsuranceCodes) ? p.acceptedInsuranceCodes.length : 0}</strong>
          </div>
        </div>

        <button class="small-btn full-width" onclick="openPharmacyModal('${p.docId}')">
          <i class="fa-solid fa-eye"></i>
          عرض التفاصيل
        </button>
      </div>
    `;
  }).join("");
}

function openPharmacyModal(pharmacyId) {
  const p = allPharmacies.find(x => x.docId === pharmacyId);
  if (!p) return;

  selectedPharmacyId = pharmacyId;

  const isBlocked = p.isBlocked === true || p.status === "blocked";

  // ===== Header =====
  document.getElementById("pharmacyModalTitle").textContent =
    p.pharmacyName || "تفاصيل الصيدلية";

  document.getElementById("pharmacyModalSubtitle").textContent =
    `${p.ownerName || "-"} • ${p.email || "-"}`;

  // ===== Details =====
  document.getElementById("pharmacyDetailsGrid").innerHTML = `
    ${detailItem("معرف الصيدلية", p.id || p.docId)}
    ${detailItem("اسم الصيدلية", p.pharmacyName)}
    ${detailItem("اسم المالك", p.ownerName)}
    ${detailItem("البريد الإلكتروني", p.email)}
    ${detailItem("رقم الهاتف", p.phoneNumber)}
    ${detailItem("رقم الترخيص", p.licenseNumber)}
    ${detailItem("رقم هوية المالك", p.ownerIdNumber)}
    ${detailItem("العنوان", p.location?.address)}
    ${detailItem("الحالة", isBlocked ? "محظورة" : (p.status || "-"))}
    ${detailItem("أونلاين", p.isOnline ? "نعم" : "لا")}
    ${detailItem("24 ساعة", p.is24Hours ? "نعم" : "لا")}
    ${detailItem("التأمينات المقبولة", formatArray(p.acceptedInsuranceCodes))}
    ${detailItem("التصنيفات", formatArray(p.categories))}
    ${detailItem("تاريخ الاعتماد", formatTimestamp(p.approvedDate))}
    ${detailItem("آخر تحديث", formatTimestamp(p.updatedAt))}
  `;

  // ===== Images (مع حماية من null) =====
  safeSetImage("pharmacyLogoPreview", p.imageUrl);
  safeSetImage("pharmacyLicensePreview", p.licenseFileUrl);
  safeSetImage("pharmacyOwnerIdPreview", p.ownerIdFileUrl);

  // ===== Block Button =====
  const toggleBtn = document.getElementById("toggleBlockBtn");

  if (toggleBtn) {
    toggleBtn.innerHTML = isBlocked
      ? `<i class="fa-solid fa-unlock"></i> فك الحظر`
      : `<i class="fa-solid fa-ban"></i> حظر الصيدلية`;

    toggleBtn.className = isBlocked ? "success-btn" : "danger-btn";
  }

  // ===== Show Modal =====
  document.getElementById("pharmacyModal").classList.remove("hidden");
}
function safeSetImage(containerId, url) {
  const el = document.getElementById(containerId);

  if (!el) {
    console.warn(`Element not found: ${containerId}`);
    return;
  }

  if (!url) {
    el.innerHTML = "لا توجد صورة";
    return;
  }

  el.innerHTML = `
    <a href="${url}" target="_blank">
      <img src="${url}" alt="image">
    </a>
  `;
}
function closePharmacyModal() {
  selectedPharmacyId = null;
  document.getElementById("pharmacyModal").classList.add("hidden");
}

async function toggleSelectedPharmacyBlock() {
  if (!selectedPharmacyId || !currentUser) return;

  const p = allPharmacies.find(x => x.docId === selectedPharmacyId);
  if (!p) return;

  const isBlocked = p.isBlocked === true || p.status === "blocked";
  const nextBlocked = !isBlocked;

  const ok = confirm(nextBlocked
    ? "هل أنتِ متأكدة من حظر هذه الصيدلية؟"
    : "هل أنتِ متأكدة من فك حظر هذه الصيدلية؟"
  );

  if (!ok) return;

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();

    const batch = db.batch();
    const pharmacyRef = db.collection("pharmacies").doc(selectedPharmacyId);
    const auditRef = db.collection("adminAuditLogs").doc();

    batch.update(pharmacyRef, {
      isBlocked: nextBlocked,
      status: nextBlocked ? "blocked" : "approved",
      updatedAt: now,
      lastStatusUpdate: now,
      blockedBy: nextBlocked ? (currentUser.email || currentUser.uid) : null,
      blockedDate: nextBlocked ? now : null
    });

    batch.set(auditRef, {
      action: nextBlocked ? "block_pharmacy" : "unblock_pharmacy",
      module: "pharmacies",
      targetType: "pharmacy",
      targetId: selectedPharmacyId,
      targetName: p.pharmacyName || "-",
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

    closePharmacyModal();
    alert(nextBlocked ? "تم حظر الصيدلية" : "تم فك الحظر عن الصيدلية");
  } catch (error) {
    console.error("Toggle pharmacy block error:", error);
    alert("حدث خطأ أثناء تحديث حالة الصيدلية");
  }
}

function openPharmacyLocation() {
  if (!selectedPharmacyId) return;

  const p = allPharmacies.find(x => x.docId === selectedPharmacyId);
  if (!p) return;

  const lat = p.location?.latitude;
  const lng = p.location?.longitude;

  if (!lat || !lng) {
    alert("لا توجد إحداثيات محفوظة لهذه الصيدلية");
    return;
  }

  window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
}

function formatArray(value) {
  if (!Array.isArray(value) || value.length === 0) return "-";
  return value.join("، ");
}