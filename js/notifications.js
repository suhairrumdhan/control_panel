function renderNotificationsPage() {
  contentArea.innerHTML = `
    <div class="panel-card">
      <div class="section-toolbar">
        <div>
          <h2>الإشعارات الجماعية</h2>
          <p>إرسال إشعارات إدارية للمستخدمين أو الصيدليات داخل النظام.</p>
        </div>
      </div>

      <div class="notification-layout">
        <div class="notification-form-card">
          <h3>إنشاء إشعار جديد</h3>

          <div class="form-group">
            <label>الفئة المستهدفة</label>
            <select id="notificationTarget" class="filter-select full-width">
              <option value="users">كل المستخدمين</option>
              <option value="pharmacies">كل الصيدليات</option>
              <option value="active_users">المستخدمون النشطون فقط</option>
              <option value="approved_pharmacies">الصيدليات المعتمدة فقط</option>
            </select>
          </div>

          <div class="form-group">
            <label>عنوان الإشعار</label>
            <input id="notificationTitle" class="search-input full-width" placeholder="مثال: تحديث مهم في النظام">
          </div>

          <div class="form-group">
            <label>نص الإشعار</label>
            <textarea id="notificationBody" class="admin-textarea" placeholder="اكتبي محتوى الإشعار هنا..."></textarea>
          </div>

          <div class="form-group">
            <label>المسار داخل التطبيق</label>
            <select id="notificationRoute" class="filter-select full-width">
              <option value="">بدون مسار</option>
              <option value="/orders">الطلبات</option>
              <option value="/notifications">الإشعارات</option>
              <option value="/profile">الملف الشخصي</option>
              <option value="/home">الرئيسية</option>
            </select>
          </div>

          <button id="sendNotificationBtn" class="primary-btn" onclick="sendBulkNotification()">
            <i class="fa-solid fa-paper-plane"></i>
            إرسال الإشعار
          </button>

          <div id="notificationMessage" class="form-message hidden"></div>
        </div>

        <div class="notification-preview-card">
          <h3>معاينة الإشعار</h3>

          <div class="phone-preview">
            <div class="phone-header">
              <span>Roshita</span>
              <i class="fa-solid fa-bell"></i>
            </div>

            <div class="push-preview">
              <div class="push-icon">
                <i class="fa-solid fa-shield-heart"></i>
              </div>
              <div>
                <strong id="previewTitle">عنوان الإشعار</strong>
                <p id="previewBody">سيظهر نص الإشعار هنا قبل الإرسال.</p>
              </div>
            </div>
          </div>

          <div class="notification-note">
            يتم حفظ الإشعارات داخل Firestore ليتم عرضها داخل التطبيق، ويمكن لاحقًا ربطها بـ Firebase Cloud Messaging للإرسال الفوري.
          </div>
        </div>
      </div>
    </div>

    <div class="panel-card mt-18">
      <h2>آخر الإشعارات الإدارية</h2>
      <div id="adminNotificationsList" class="mini-list">
        <div class="empty-state">جاري تحميل الإشعارات...</div>
      </div>
    </div>
  `;

  document.getElementById("notificationTitle").addEventListener("input", updateNotificationPreview);
  document.getElementById("notificationBody").addEventListener("input", updateNotificationPreview);

  listenAdminNotifications();
}

function updateNotificationPreview() {
  const title = document.getElementById("notificationTitle")?.value.trim();
  const body = document.getElementById("notificationBody")?.value.trim();

  setText("previewTitle", title || "عنوان الإشعار");
  setText("previewBody", body || "سيظهر نص الإشعار هنا قبل الإرسال.");
}

async function sendBulkNotification() {
  if (!currentUser) return;

  const target = document.getElementById("notificationTarget").value;
  const title = document.getElementById("notificationTitle").value.trim();
  const body = document.getElementById("notificationBody").value.trim();
  const route = document.getElementById("notificationRoute").value;

  if (!title || !body) {
    showNotificationMessage("يرجى إدخال عنوان ونص الإشعار", "error");
    return;
  }

  const btn = document.getElementById("sendNotificationBtn");

  try {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...`;

    const now = firebase.firestore.FieldValue.serverTimestamp();

    const notificationRef = db.collection("adminBroadcastNotifications").doc();
    const auditRef = db.collection("adminAuditLogs").doc();

    const batch = db.batch();

    batch.set(notificationRef, {
      title,
      body,
      target,
      targetRoute: route || null,
      type: "admin_broadcast",
      status: "sent",
      createdAt: now,
      sentBy: {
        uid: currentUser.uid,
        email: currentUser.email || "",
        name: currentUser.displayName || "Admin"
      },
      source: "admin_panel_web"
    });

    batch.set(auditRef, {
      action: "send_broadcast_notification",
      module: "notifications",
      targetType: target,
      targetId: notificationRef.id,
      targetName: title,
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

    document.getElementById("notificationTitle").value = "";
    document.getElementById("notificationBody").value = "";
    document.getElementById("notificationRoute").value = "";
    updateNotificationPreview();

    showNotificationMessage("تم حفظ الإشعار الجماعي بنجاح", "success");
  } catch (error) {
    console.error("Send notification error:", error);
    showNotificationMessage("حدث خطأ أثناء إرسال الإشعار", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> إرسال الإشعار`;
  }
}

function listenAdminNotifications() {
  db.collection("adminBroadcastNotifications")
    .orderBy("createdAt", "desc")
    .limit(10)
    .onSnapshot((snapshot) => {
      const container = document.getElementById("adminNotificationsList");
      if (!container) return;

      if (snapshot.empty) {
        container.innerHTML = `<div class="empty-state">لا توجد إشعارات إدارية بعد</div>`;
        return;
      }

      container.innerHTML = snapshot.docs.map(doc => {
        const n = doc.data();

        return `
          <div class="mini-row">
            <div>
              <strong>${escapeHtml(n.title || "-")}</strong>
              <span>${escapeHtml(n.body || "-")}</span>
              <span>${formatNotificationTarget(n.target)} • ${formatTimestamp(n.createdAt)}</span>
            </div>
            <b class="status-badge status-approved">مرسل</b>
          </div>
        `;
      }).join("");
    }, (error) => {
      console.error("Load admin notifications error:", error);
      const container = document.getElementById("adminNotificationsList");
      if (container) {
        container.innerHTML = `<div class="empty-state error-text">فشل تحميل الإشعارات</div>`;
      }
    });
}

function showNotificationMessage(message, type) {
  const el = document.getElementById("notificationMessage");
  if (!el) return;

  el.textContent = message;
  el.className = `form-message ${type}`;
  el.classList.remove("hidden");
}

function formatNotificationTarget(target) {
  const map = {
    users: "كل المستخدمين",
    pharmacies: "كل الصيدليات",
    active_users: "المستخدمون النشطون",
    approved_pharmacies: "الصيدليات المعتمدة"
  };

  return map[target] || target || "-";
}