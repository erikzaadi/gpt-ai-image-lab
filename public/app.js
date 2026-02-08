const chatMessages = document.getElementById("chatMessages");
const promptInput = document.getElementById("prompt");
const btn = document.getElementById("go");
const themeToggle = document.getElementById("themeToggle");
const html = document.documentElement;

const conversationHistory = [];

const bgColors = [
  ["#1a1a2e", "#16213e"],
  ["#2d132c", "#801336"],
  ["#1a3c40", "#1d5c63"],
  ["#2c003e", "#512b58"],
  ["#1b262c", "#0f4c75"],
  ["#1f1f38", "#3d3d6b"],
  ["#0d1b2a", "#1b263b"],
  ["#2b2024", "#4a3728"],
  ["#1a2639", "#3e4a61"],
  ["#2c1810", "#5c3d2e"]
];

function changeBackground() {
  const colors = bgColors[Math.floor(Math.random() * bgColors.length)];
  document.body.style.background = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
}

function getTheme() {
  return localStorage.getItem("theme") || "dark";
}

function setTheme(theme) {
  html.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  themeToggle.textContent = theme === "dark" ? "\u2600\ufe0f" : "\ud83c\udf19";
}

setTheme(getTheme());

themeToggle.onclick = () => {
  const current = html.getAttribute("data-theme");
  setTheme(current === "dark" ? "light" : "dark");
};

function addMessage(type, content) {
  const message = document.createElement("div");
  message.className = "message " + type;
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.innerHTML = content;
  message.appendChild(bubble);
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return message;
}

function addThinkingMessage() {
  return addMessage("assistant", `
    <div class="thinking">
      <span>Thinking</span>
      <div class="thinking-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `);
}

btn.onclick = async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    return;
  }

  addMessage("user", prompt);
  promptInput.value = "";
  changeBackground();

  btn.disabled = true;
  btn.textContent = "...";

  const thinkingMsg = addThinkingMessage();

  try {
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, history: conversationHistory })
    });
    const data = await r.json();

    thinkingMsg.remove();

    if (data.error) {
      addMessage("assistant", '<span class="error">' + data.error + '</span>');
    } else {
      conversationHistory.push(prompt);
      if (conversationHistory.length > 10) {
        conversationHistory.shift();
      }
      let imgSrc;
      if (data.b64) {
        imgSrc = "data:image/png;base64," + data.b64;
      } else {
        imgSrc = data.url;
      }
      const msg = addMessage("assistant", 'Here\'s your image:<img src="' + imgSrc + '" alt="Generated image" />');
      const img = msg.querySelector("img");
      if (img) {
        img.onload = () => {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        };
      }
    }
  } catch (err) {
    thinkingMsg.remove();
    addMessage("assistant", '<span class="error">Failed to generate image. Please try again.</span>');
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate";
  }
};

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    btn.click();
  }
});
