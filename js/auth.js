let currentUser = null;

const loginPage = document.getElementById("loginPage");
const appShell = document.getElementById("appShell");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const errorMessage = document.getElementById("errorMessage");

loginBtn.addEventListener("click", login);
logoutBtn.addEventListener("click", logout);

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
    return;
  }

  try {
    errorMessage.style.display = "none";
    loginBtn.disabled = true;
    loginBtn.textContent = "جاري الدخول...";

    const result = await auth.signInWithEmailAndPassword(email, password);
    currentUser = result.user;
  } catch (error) {
    showError("بيانات الدخول غير صحيحة أو الحساب غير مصرح له");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "تسجيل الدخول";
  }
}

async function logout() {
  await auth.signOut();
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = "block";
}

auth.onAuthStateChanged((user) => {
  currentUser = user;

  if (user) {
    loginPage.classList.add("hidden");
    appShell.classList.remove("hidden");

    document.getElementById("userName").textContent =
      user.displayName || "مسؤول النظام";
    document.getElementById("userEmail").textContent = user.email || "-";

    renderDashboard();
    listenDashboardStats();
  } else {
    appShell.classList.add("hidden");
    loginPage.classList.remove("hidden");
  }
});