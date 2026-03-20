const {
  auth,
  db,
  signInAnonymously,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc
} = window.firebaseRefs;

// ===== PIN 설정 =====
const PINS = {
  "민주": "1234",
  "석민": "5678"
};

// ===== 상태 =====
let selectedRole = null;
let currentRole = localStorage.getItem("currentRole") || "";
let questions = [];
let currentQuestionId = null;
let currentQuestionData = null;

// ===== DOM =====
const currentRoleEl = document.getElementById("currentRole");

const menuButtons = document.querySelectorAll(".menu-btn");
const views = document.querySelectorAll(".view");

const roleModal = document.getElementById("roleModal");
const roleButtons = document.querySelectorAll(".role-btn");
const pinInput = document.getElementById("pinInput");
const confirmRoleBtn = document.getElementById("confirmRoleBtn");
const roleError = document.getElementById("roleError");
const changeRoleBtn = document.getElementById("changeRoleBtn");

const questionInput = document.getElementById("questionInput");
const addQuestionBtn = document.getElementById("addQuestionBtn");

const minjuPendingList = document.getElementById("minjuPendingList");
const seokminPendingList = document.getElementById("seokminPendingList");
const doneList = document.getElementById("doneList");

const detailModal = document.getElementById("detailModal");
const closeDetailBtn = document.getElementById("closeDetailBtn");
const detailQuestion = document.getElementById("detailQuestion");
const minjuAnswerView = document.getElementById("minjuAnswerView");
const seokminAnswerView = document.getElementById("seokminAnswerView");
const answerEditor = document.getElementById("answerEditor");
const editorTitle = document.getElementById("editorTitle");
const answerInput = document.getElementById("answerInput");
const saveAnswerBtn = document.getElementById("saveAnswerBtn");

// ===== 시작 =====
init();

async function init() {
  try {
    await signInAnonymously(auth);
    console.log("익명 로그인 완료");

    if (currentRole) {
      currentRoleEl.textContent = currentRole;
      roleModal.classList.remove("show");
    } else {
      roleModal.classList.add("show");
    }

    setupRoleSelection();
    setupMenu();
    setupQuestionAdd();
    setupDetailModal();
    listenQuestions();
  } catch (error) {
    console.error(error);
    alert("Firebase 연결 또는 익명 로그인에 실패했어.");
  }
}

// ===== 역할 선택 =====
function setupRoleSelection() {
  roleButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      roleButtons.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedRole = btn.dataset.role;
      roleError.textContent = "";
    });
  });

  confirmRoleBtn.addEventListener("click", () => {
    const pin = pinInput.value.trim();

    if (!selectedRole) {
      roleError.textContent = "역할을 먼저 선택해줘.";
      return;
    }

    if (pin !== PINS[selectedRole]) {
      roleError.textContent = "PIN이 일치하지 않아.";
      return;
    }

    currentRole = selectedRole;
    localStorage.setItem("currentRole", currentRole);
    currentRoleEl.textContent = currentRole;

    roleModal.classList.remove("show");
    pinInput.value = "";
    roleError.textContent = "";
  });

  changeRoleBtn.addEventListener("click", () => {
    selectedRole = null;
    roleButtons.forEach(b => b.classList.remove("selected"));
    pinInput.value = "";
    roleError.textContent = "";
    roleModal.classList.add("show");
  });
}

// ===== 메뉴 전환 =====
function setupMenu() {
  menuButtons.forEach(button => {
    button.addEventListener("click", () => {
      const targetView = button.dataset.view;

      menuButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      views.forEach(view => view.classList.remove("active"));
      document.getElementById(`view-${targetView}`).classList.add("active");
    });
  });
}

// ===== 질문 등록 =====
function setupQuestionAdd() {
  addQuestionBtn.addEventListener("click", async () => {
    const question = questionInput.value.trim();

    if (!question) {
      alert("질문 내용을 입력해줘.");
      return;
    }

    try {
      await addDoc(collection(db, "questions"), {
        question,
        createdAt: serverTimestamp(),
        minjuAnswer: "",
        seokminAnswer: "",
        minjuAnswered: false,
        seokminAnswered: false
      });

      questionInput.value = "";
      alert("질문이 등록됐어.");
    } catch (error) {
      console.error(error);
      alert("질문 등록에 실패했어.");
    }
  });
}

// ===== 질문 실시간 불러오기 =====
function listenQuestions() {
  const q = query(collection(db, "questions"), orderBy("createdAt", "desc"));

  onSnapshot(q, snapshot => {
    questions = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    renderLists();
  }, error => {
    console.error(error);
    alert("질문 목록을 불러오지 못했어.");
  });
}

// ===== 목록 렌더링 =====
function renderLists() {
  const minjuPending = questions.filter(item => !item.minjuAnswered);
  const seokminPending = questions.filter(item => !item.seokminAnswered);
  const done = questions.filter(item => item.minjuAnswered && item.seokminAnswered);

  renderQuestionList(minjuPendingList, minjuPending, "민주");
  renderQuestionList(seokminPendingList, seokminPending, "석민");
  renderQuestionList(doneList, done, "완료");
}

function renderQuestionList(container, list, type) {
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-text">아직 항목이 없어</div>`;
    return;
  }

  container.innerHTML = "";

  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "question-item";

    let metaText = "";
    if (type === "민주") metaText = "민주가 아직 답변하지 않은 질문";
    if (type === "석민") metaText = "석민이 아직 답변하지 않은 질문";
    if (type === "완료") metaText = "둘 다 답변 완료";

    div.innerHTML = `
      <div>${escapeHtml(item.question)}</div>
      <div class="meta">${metaText}</div>
    `;

    div.addEventListener("click", () => openDetailModal(item));
    container.appendChild(div);
  });
}

// ===== 상세 모달 =====
function setupDetailModal() {
  closeDetailBtn.addEventListener("click", closeDetailModal);

  detailModal.addEventListener("click", (e) => {
    if (e.target === detailModal) {
      closeDetailModal();
    }
  });

  saveAnswerBtn.addEventListener("click", saveAnswer);
}

function openDetailModal(item) {
  currentQuestionId = item.id;
  currentQuestionData = item;

  detailQuestion.textContent = item.question;

  const bothAnswered = item.minjuAnswered && item.seokminAnswered;
  const myAnswerField = currentRole === "민주" ? "minjuAnswer" : "seokminAnswer";
  const myAnsweredField = currentRole === "민주" ? "minjuAnswered" : "seokminAnswered";

  // 기본 표시
  minjuAnswerView.textContent = "아직 답변 전";
  seokminAnswerView.textContent = "아직 답변 전";

  // 둘 다 답했으면 둘 다 공개
  if (bothAnswered) {
    minjuAnswerView.textContent = item.minjuAnswer || "아직 답변 전";
    seokminAnswerView.textContent = item.seokminAnswer || "아직 답변 전";
  } else {
    // 아직 둘 다 안 했으면 내 답변만 보이게
    if (currentRole === "민주") {
      minjuAnswerView.textContent = item.minjuAnswer || "아직 답변 전";
      seokminAnswerView.textContent = item.minjuAnswered
        ? "석민 답변은 서로 답변 완료 후 공개돼"
        : "석민 답변은 서로 답변 완료 후 공개돼";
    } else if (currentRole === "석민") {
      seokminAnswerView.textContent = item.seokminAnswer || "아직 답변 전";
      minjuAnswerView.textContent = item.seokminAnswered
        ? "민주 답변은 서로 답변 완료 후 공개돼"
        : "민주 답변은 서로 답변 완료 후 공개돼";
    }
  }

  // 내가 아직 답 안 했으면 입력창 열기
  if (!item[myAnsweredField]) {
    answerEditor.classList.remove("hidden");
    editorTitle.textContent = `${currentRole} 답변 작성`;
    answerInput.value = item[myAnswerField] || "";
  } else {
    answerEditor.classList.add("hidden");
    answerInput.value = "";
  }

  detailModal.classList.add("show");
}

function closeDetailModal() {
  detailModal.classList.remove("show");
  currentQuestionId = null;
  currentQuestionData = null;
  answerInput.value = "";
}

// ===== 답변 저장 =====
async function saveAnswer() {
  if (!currentQuestionId || !currentQuestionData) return;

  const answer = answerInput.value.trim();
  if (!answer) {
    alert("답변을 입력해줘.");
    return;
  }

  let updateData = {};

  if (currentRole === "민주") {
    updateData = {
      minjuAnswer: answer,
      minjuAnswered: true
    };
  } else if (currentRole === "석민") {
    updateData = {
      seokminAnswer: answer,
      seokminAnswered: true
    };
  } else {
    alert("역할 정보가 없어.");
    return;
  }

  try {
    await updateDoc(doc(db, "questions", currentQuestionId), updateData);
    alert("답변 저장 완료");
    closeDetailModal();
  } catch (error) {
    console.error(error);
    alert("답변 저장에 실패했어.");
  }
}

// ===== XSS 방지용 =====
function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
