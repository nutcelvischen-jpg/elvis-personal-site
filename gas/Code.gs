/**
 * Google Apps Script 後端代理：串接 OpenRouter API (anthropic/claude-haiku-5.5)
 *
 * 【部署與設定步驟】
 * 1. 前往 script.google.com 建立新專案，貼上此程式碼。
 * 2. 左側「專案設定 (齒輪)」->「指令碼屬性」-> 新增屬性：
 *    - 屬性名稱：OPENROUTER_API_KEY
 *    - 屬性值：你的 OpenRouter API Key（sk-or-v1-...）
 * 3. 右上角「部署」->「新增部署作業」-> 類型選「網頁應用程式」：
 *    - 執行身分：我
 *    - 誰可以存取：所有人
 * 4. 複製產生的網頁應用程式網址（.../exec），貼到個人網站右下角小客服的 ⚙️ 設定裡即可使用！
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_ID = "anthropic/claude-haiku-5.5";

const SYSTEM_PROMPT = [
  "你是 Elvis Chen（陳柏宇）個人網站右下角的 AI 小客服機器人。",
  "請用親切、專業、簡潔的繁體中文回答訪客問題。",
  "關於 Elvis Chen 的基本資料：",
  "- 角色：AI 應用與全端開發者（台中，台灣）",
  "- 專長：OpenRouter / Claude / Gemini AI Agent 整合、Google Apps Script 自動化、資料視覺化儀表板、GitHub Pages 與現代網頁開發",
  "- 代表作品：智慧個人客服機器人系統、即時營運與市場數據儀表板、企業雲端打卡與表單通知系統",
  "- GitHub：https://github.com/nutcelvischen-jpg",
  "若訪客詢問合作或聯絡方式，請引導他們透過網站上的 GitHub 連結或聯絡區塊聯繫 Elvis。"
].join("\n");

function doGet() {
  return jsonResponse({
    ok: true,
    model: MODEL_ID,
    message: "Elvis AI Chatbot GAS backend is ready."
  });
}

function doPost(e) {
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty("OPENROUTER_API_KEY");
    if (!apiKey) {
      return jsonResponse({
        error: "尚未在 GAS「指令碼屬性」中設定 OPENROUTER_API_KEY。"
      });
    }

    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ error: "未收到請求內容 (postData)。" });
    }

    const body = JSON.parse(e.postData.contents);
    const clientMessages = Array.isArray(body.messages) ? body.messages : [];
    if (clientMessages.length === 0) {
      return jsonResponse({ error: "messages 不可為空。" });
    }

    // 保留前端傳來的每則訊息（包含 assistant 的 reasoning_details）
    const sanitizedMessages = clientMessages.map(function (msg) {
      const item = {
        role: msg.role,
        content: msg.content
      };
      if (msg.role === "assistant" && msg.reasoning_details !== undefined && msg.reasoning_details !== null) {
        item.reasoning_details = msg.reasoning_details;
      }
      return item;
    });

    const fullMessages = [{ role: "system", content: SYSTEM_PROMPT }].concat(sanitizedMessages);

    const payload = {
      model: MODEL_ID,
      messages: fullMessages,
      reasoning: { enabled: true }
    };

    const res = UrlFetchApp.fetch(OPENROUTER_URL, {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + apiKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const statusCode = res.getResponseCode();
    const resText = res.getContentText();
    const data = JSON.parse(resText);

    if (statusCode < 200 || statusCode >= 300 || data.error) {
      const errMsg = (data.error && data.error.message) ? data.error.message : ("OpenRouter HTTP " + statusCode);
      return jsonResponse({ error: errMsg });
    }

    const assistantMsg = data.choices && data.choices[0] && data.choices[0].message;
    if (!assistantMsg) {
      return jsonResponse({ error: "OpenRouter 回傳格式異常，找不到 choices[0].message。" });
    }

    return jsonResponse({
      content: assistantMsg.content || "",
      reasoning_details: assistantMsg.reasoning_details !== undefined ? assistantMsg.reasoning_details : null
    });
  } catch (err) {
    return jsonResponse({
      error: "GAS 執行錯誤：" + err.message
    });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
