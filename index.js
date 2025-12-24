const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

/* ================== CONFIG ================== */
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMINS = [1913597752];
const HOUSE_RATE = 0.95;

/* ================== WEB ================== */
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

/* ================== BOT ================== */
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ================== DATABASE (RAM) ================== */
const users = {};
const withdrawRequests = [];

function initUser(id) {
  if (!users[id]) {
    users[id] = {
      balance: 0, // ✅ BẮT ĐẦU = 0
      step: null,
      betAmount: 0,
      choice: null,
      dices: [],
      playing: false,
      withdrawAmount: 0,
      withdrawInfo: ""
    };
  }
}

/* ================== MENU ================== */
function mainMenu(chatId) {
  bot.sendMessage(chatId, "🎮 MENU CHÍNH", {
    reply_markup: {
      keyboard: [
        ["👤 Thông tin cá nhân"],
        ["🎲 Game xúc xắc"],
        ["💳 Nạp tiền"],
        ["💰 Số dư", "💸 Rút tiền"]
      ],
      resize_keyboard: true
    }
  });
}

/* ================== START ================== */
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  initUser(chatId);

  bot.sendMessage(chatId,
`🎉 CHÀO MỪNG ĐẾN GAME XÚC XẮC 🎉

📌 Nhập tiền cược VD:
👉 10,000 VND → nhập: 10000

⚠️ BOT CHỈ CÓ 1 ADMIN:
👉 @admxucxactele`
  );

  mainMenu(chatId);
});

/* ================== MESSAGE ================== */
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  initUser(chatId);
  const user = users[chatId];

  if (text === "👤 Thông tin cá nhân") {
    return bot.sendMessage(chatId,
`👤 ID: ${chatId}
💰 Số dư: ${user.balance.toLocaleString()} VND`);
  }

  if (text === "💳 Nạp tiền") {
    return bot.sendMessage(chatId,
"👉 Liên hệ admin: @admxucxactele");
  }

  if (text === "💰 Số dư") {
    return bot.sendMessage(chatId,
`💰 ${user.balance.toLocaleString()} VND`);
  }
/* ===== RÚT TIỀN ===== */
if (text === "💸 Rút tiền") {
  user.step = "withdraw_amount";
  return bot.sendMessage(chatId,
`💸 RÚT TIỀN
✅ Tối thiểu: 50,000 VND
🏧 Nhập số tiền muốn rút`);
}

if (user.step === "withdraw_amount") {
  const amount = parseInt(text);
  if (isNaN(amount) || amount < 50000)
    return bot.sendMessage(chatId, "❌ Số tiền rút tối thiểu 50,000 VND");
  if (amount > user.balance)
    return bot.sendMessage(chatId, "❌ Số dư không đủ");

  user.withdrawAmount = amount;
  user.step = "withdraw_info";

  return bot.sendMessage(chatId,
`📄 Nhập thông tin ngân hàng
Ví dụ:
Vietcombank N.V.A 123456789`);
}

if (user.step === "withdraw_info") {
  user.withdrawInfo = text;
  user.step = "withdraw_confirm";

  return bot.sendMessage(chatId,
`⚠️ XÁC NHẬN RÚT TIỀN
💰 ${user.withdrawAmount.toLocaleString()} VND`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Chắc chắn", callback_data: "confirm_withdraw" }],
        [{ text: "⬅️ Quay lại", callback_data: "cancel_withdraw" }]
      ]
    }
  });
}
  /* ===== START GAME ===== */
  if (text === "🎲 Game xúc xắc") {
    user.step = "bet";
    return bot.sendMessage(chatId,
`💵 NHẬP TIỀN CƯỢC
📌 VD: 10,000 → nhập 10000
(min 5,000 – max 10,000,000)`);
  }

  if (user.step === "bet") {
    const amount = parseInt(text);
    if (isNaN(amount) || amount < 5000 || amount > 10000000)
      return bot.sendMessage(chatId, "❌ Số tiền không hợp lệ");
    if (amount > user.balance)
      return bot.sendMessage(chatId, "❌ Số dư không đủ");

    user.betAmount = amount;
    user.step = "choose";

    return bot.sendMessage(chatId, "👉 Chọn cửa", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔽 Nhỏ (3–10)", callback_data: "small" }],
          [{ text: "🔼 Lớn (11–18)", callback_data: "big" }]
        ]
      }
    });
  }

  /* ===== XÚC ===== */
  if (text === "🎲 Xúc" && user.playing) {
    const dice = await bot.sendDice(chatId);
    user.dices.push(dice.dice.value);

    if (user.dices.length < 3) {
      return bot.sendMessage(chatId,
`🎲 Đã xúc ${user.dices.length}/3
👉 Bấm 🎲 Xúc tiếp`);
    }

    const total = user.dices.reduce((a, b) => a + b, 0);
    const win =
      (user.choice === "small" && total <= 10) ||
      (user.choice === "big" && total >= 11);

    let change;
    if (win) {
      change = Math.floor(user.betAmount * HOUSE_RATE);
      user.balance += change;
    } else {
      change = user.betAmount;
      user.balance -= change;
    }

    user.playing = false;
    user.dices = [];
    user.step = null;

    return bot.sendMessage(chatId,
`🎲 KẾT QUẢ: ${total}
${win ? "🎉 THẮNG" : "❌ THUA"}
💰 Số dư: ${user.balance.toLocaleString()} VND`, {
      reply_markup: {
        keyboard: [["🎮 Chơi tiếp"], ["🏠 Menu chính"]],
        resize_keyboard: true
      }
    });
  }

  if (text === "🎮 Chơi tiếp") {
    user.step = "bet";
    return bot.sendMessage(chatId,
"💵 Nhập tiền cược mới", {
      reply_markup: { remove_keyboard: true }
    });
  }

  if (text === "🏠 Menu chính") {
    return mainMenu(chatId);
  }
});
// ===== LOG GỬI ADMIN =====
ADMINS.forEach(aid => {
  bot.sendMessage(aid,
`📊 LOG PHIÊN XÚC XẮC

👤 ID USER: ${chatId}
💵 Tiền cược: ${user.betAmount.toLocaleString()} VND
🎯 Cửa chọn: ${user.choice === "small" ? "Nhỏ" : "Lớn"}
🎲 Tổng điểm: ${total}
📌 Kết quả: ${win ? "THẮNG" : "THUA"}
💸 ${win ? "+" : "-"}${change.toLocaleString()} VND
💰 Số dư còn lại: ${user.balance.toLocaleString()} VND`);
});

/* ================== CALLBACK ================== */
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  const user = users[chatId];

  if (q.data === "small" || q.data === "big") {
    user.choice = q.data;
    user.dices = [];
    user.playing = true;

    bot.sendMessage(chatId,
"🎲 BẤM NÚT DƯỚI ĐỂ XÚC (3 LẦN)", {
      reply_markup: {
        keyboard: [["🎲 Xúc"]],
        resize_keyboard: true
      }
    });
  }
});

/* ================== ADMIN ================== */
bot.onText(/\/naptien (\d+) (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;
  initUser(m[1]);
  users[m[1]].balance += parseInt(m[2]);

  bot.sendMessage(m[1],
`🎉 Bạn được nạp ${parseInt(m[2]).toLocaleString()} VND`);

  bot.sendMessage(msg.chat.id,
`✅ Đã nạp tiền cho ID ${m[1]}`);
});