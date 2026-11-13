(() => {
  const STORAGE_KEY = "elvis_gas_web_app_url";

  // DOM Elements
  const yearEl = document.getElementById("year");
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileNav = document.getElementById("mobile-nav");

  const robotFab = document.getElementById("robot-fab");
  const chatWindow = document.getElementById("chat-window");
  const navOpenChat = document.getElementById("nav-open-chat");
  const contactOpenChat = document.getElementById("contact-open-chat");
  const btnCloseChat = document.getElementById("btn-close-chat");
  const btnClearChat = document.getElementById("btn-clear-chat");

  const btnSettings = document.getElementById("btn-settings");
  const chatSettings = document.getElementById("chat-settings");
  const gasUrlInput = document.getElementById("gas-url-input");
  const btnSaveGas = document.getElementById("btn-save-gas");
  const btnTestGas = document.getElementById("btn-test-gas");
  const btnCloseSettings = document.getElementById("btn-close-settings");
  const settingsFeedback = document.getElementById("settings-feedback");

  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");

  const chatMessages = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const btnSend = document.getElementById("btn-send");
  const quickChips = document.querySelectorAll(".quick-chip");

  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Mobile nav toggle
  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener("click", () => {
      mobileNav.classList.toggle("open");
    });
    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => mobileNav.classList.remove("open"));
    });
  }

  // Conversation history (preserves reasoning_details for OpenRouter)
  let chatHistory = [];
  let isSending = false;

  function getGasUrl() {
    return (localStorage.getItem(STORAGE_KEY) || "").trim();
  }

  function updateConnectionStatus() {
    const url = getGasUrl();
    if (url) {
      statusDot.classList.add("connected");
      statusText.textContent = "已設定 GAS 後端";
    } else {
      statusDot.classList.remove("connected");
      statusText.textContent = "尚未設定 GAS 網址";
    }
  }

  function openChat() {
    chatWindow.classList.add("open");
    chatWindow.setAttribute("aria-hidden", "false");
    chatInput.focus();
  }

  function closeChat() {
    chatWindow.classList.remove("open");
    chatWindow.setAttribute("aria-hidden", "true");
  }

  function toggleSettings(forceOpen) {
    const willOpen = typeof forceOpen === "boolean" ? forceOpen : chatSettings.hidden;
    chatSettings.hidden = !willOpen;
    if (willOpen) {
      gasUrlInput.value = getGasUrl();
      settingsFeedback.textContent = "";
      settingsFeedback.className = "settings-feedback";
      gasUrlInput.focus();
    }
  }

  function setFeedback(message, isError = false) {
    settingsFeedback.textContent = message;
    settingsFeedback.className = `settings-feedback ${isError ? "err" : "ok"}`;
  }

  function appendMessage(role, text, isError = false) {
    const wrapper = document.createElement("div");
    wrapper.className = `msg ${role === "user" ? "msg-user" : "msg-bot"}${isError ? " msg-error" : ""}`;

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.textContent = text;

    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return wrapper;
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const gasUrl = getGasUrl();
    if (!gasUrl) {
      openChat();
      toggleSettings(true);
      setFeedback("請先貼上並儲存你的 GAS Web App 網址再開始對話。", true);
      return;
    }

    isSending = true;
    btnSend.disabled = true;
    chatInput.value = "";

    appendMessage("user", trimmed);
    chatHistory.push({ role: "user", content: trimmed });

    const loadingEl = appendMessage("assistant", "思考中...");

    try {
      // Use text/plain to avoid CORS preflight issues with Google Apps Script Web Apps
      const res = await fetch(gasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          messages: chatHistory
        }),
        redirect: "follow"
      });

      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error("GAS 回傳非 JSON 格式，請確認部署權限設為「所有人」。");
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const replyContent = data.content || "（模型沒有回傳文字內容）";
      loadingEl.remove();
      appendMessage("assistant", replyContent);

      // Preserve reasoning_details unmodified for multi-turn OpenRouter reasoning
      const assistantMsg = {
        role: "assistant",
        content: replyContent
      };
      if (data.reasoning_details !== undefined && data.reasoning_details !== null) {
        assistantMsg.reasoning_details = data.reasoning_details;
      }
      chatHistory.push(assistantMsg);
    } catch (err) {
      loadingEl.remove();
      // Remove the failed user turn so history stays clean
      chatHistory.pop();
      appendMessage("assistant", `連線失敗：${err.message}`, true);
    } finally {
      isSending = false;
      btnSend.disabled = false;
      chatInput.focus();
    }
  }

  // Event Listeners
  robotFab.addEventListener("click", () => {
    if (chatWindow.classList.contains("open")) {
      closeChat();
    } else {
      openChat();
    }
  });

  if (navOpenChat) navOpenChat.addEventListener("click", openChat);
  if (contactOpenChat) contactOpenChat.addEventListener("click", openChat);
  btnCloseChat.addEventListener("click", closeChat);

  btnSettings.addEventListener("click", () => toggleSettings());
  btnCloseSettings.addEventListener("click", () => toggleSettings(false));

  btnSaveGas.addEventListener("click", () => {
    const val = gasUrlInput.value.trim();
    if (!val) {
      localStorage.removeItem(STORAGE_KEY);
      updateConnectionStatus();
      setFeedback("已清除 GAS 網址設定。");
      return;
    }
    if (!/^https:\/\/script\.google\.com\//i.test(val)) {
      setFeedback("網址格式看起來不像 Google Apps Script（應以 https://script.google.com/ 開頭）。", true);
      return;
    }
    localStorage.setItem(STORAGE_KEY, val);
    updateConnectionStatus();
    setFeedback("已儲存！現在可以開始與 AI 小客服對話。");
  });

  btnTestGas.addEventListener("click", async () => {
    const val = gasUrlInput.value.trim() || getGasUrl();
    if (!val) {
      setFeedback("請先輸入 GAS Web App 網址。", true);
      return;
    }
    setFeedback("正在測試連線...");
    try {
      const res = await fetch(val, { method: "GET", redirect: "follow" });
      const data = await res.json();
      if (data && data.ok) {
        setFeedback(`連線成功！後端狀態：${data.message || "正常"}`);
      } else {
        setFeedback("有收到回應，但格式不如預期，請檢查 Code.gs。", true);
      }
    } catch (err) {
      setFeedback(`測試失敗：${err.message}`, true);
    }
  });

  btnClearChat.addEventListener("click", () => {
    chatHistory = [];
    chatMessages.innerHTML = "";
    appendMessage("assistant", "對話已清除！有什麼我可以幫你的嗎？ 🤖");
  });

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage(chatInput.value);
  });

  quickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-prompt");
      if (prompt) sendMessage(prompt);
    });
  });

  // Init
  updateConnectionStatus();
})();
