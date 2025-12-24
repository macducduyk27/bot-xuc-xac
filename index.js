const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

/* ================== CONFIG ================== */
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMINS = [1913597752]; // ✅ ADMIN DUY NHẤT
const HOUSE_RATE = 0.95; // tỷ lệ nhà cái

/* ================== WEB ================== */
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

/* ================== BOT ================== */
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ================== DATABASE (RAM) ================== */
const users = {};
const withdrawRequests = []; // danh sách rút chờ duyệt

function initUser(id) {
  if (!users[id]) {
    users[id] = {
      balance: 100000,
      step: null,
      betAmount: 0,
      choice: null,
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
`🎉 CHÀO MỪNG BẠN ĐẾN VỚI GAME XÚC XẮC 🎉

🎲 Trò chơi giải trí minh bạch – công bằng
💰 Thắng thua cập nhật số dư tức thì
🔒 Hệ thống tự động – bảo mật

⚠️ LƯU Ý:
BOT chỉ có **01 ADMIN DUY NHẤT**: @admxucxactele  
Ngoài tài khoản trên, **tất cả đều là giả mạo**.

👉 Chọn chức năng bên dưới để bắt đầu 🍀`
  );

  mainMenu(chatId);
});

/* ================== MESSAGE ================== */
bot.on("message", (msg) => {
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
`💳 NẠP TIỀN
👉 Vui lòng liên hệ admin: @admxucxactele`);
  }

  if (text === "💰 Số dư") {
    return bot.sendMessage(chatId,
`💰 Số dư hiện tại: ${user.balance.toLocaleString()} VND`);
  }

  /* ===== GAME ===== */
  if (text === "🎲 Game xúc xắc") {
    user.step = "bet";
    return bot.sendMessage(chatId,
"💵 Nhập số tiền cược (tối thiểu 5,000 – tối đa 10,000,000)");
  }

  if (user.step === "bet") {
    const amount = parseInt(text);
    if (isNaN(amount) || amount < 5000 || amount > 10000000)
      return bot.sendMessage(chatId, "❌ Số tiền cược không hợp lệ");
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
    if (isNaN(amount) || amount < 50000 || amount > user.balance)
      return bot.sendMessage(chatId, "❌ Số tiền rút không hợp lệ");

    user.withdrawAmount = amount;
    user.step = "withdraw_info";

    return bot.sendMessage(chatId,
`📄 Nhập: Tên ngân hàng + Họ tên + STK
Ví dụ: Vietcombank N.V.A 123456789`);
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
});

/* ================== CALLBACK ================== */
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  const user = users[chatId];

  /* ===== GAME RESULT ===== */
  if (q.data === "small" || q.data === "big") {
    const d1 = roll(), d2 = roll(), d3 = roll();
    const total = d1 + d2 + d3;

    const win =
      (q.data === "small" && total <= 10) ||
      (q.data === "big" && total >= 11);

    let change = 0;
    let resultText = "";

    if (win) {
      change = Math.floor(user.betAmount * HOUSE_RATE);
      user.balance += change;
      resultText = "🎉 THẮNG";
    } else {
      change = user.betAmount;
      user.balance -= change;
      resultText = "❌ THUA";
    }

    bot.sendMessage(chatId,
`🎲 KẾT QUẢ
🎲 ${d1} | ${d2} | ${d3}
➕ Tổng: ${total}

${resultText}
💰 Số dư: ${user.balance.toLocaleString()} VND`);

    // gửi log cho admin
    ADMINS.forEach(aid => {
      bot.sendMessage(aid,
`📊 LOG PHIÊN XÚC XẮC

👤 ID: ${chatId}
🎲 ${d1}-${d2}-${d3} = ${total}
💵 Cược: ${user.betAmount.toLocaleString()} VND
📌 Kết quả: ${resultText}
💸 ${win ? "+" : "-"}${change.toLocaleString()} VND
💰 Số dư còn: ${user.balance.toLocaleString()} VND`);
    });

    user.step = null;
  }

  /* ===== CONFIRM WITHDRAW ===== */
  if (q.data === "confirm_withdraw") {
    user.balance -= user.withdrawAmount;

    const req = {
      userId: chatId,
      amount: user.withdrawAmount,
      info: user.withdrawInfo,
      time: new Date().toLocaleString("vi-VN")
    };

    withdrawRequests.push(req);
    user.step = null;

    bot.sendMessage(chatId,
`✅ GỬI LỆNH RÚT THÀNH CÔNG
💰 ${req.amount.toLocaleString()} VND
⏳ Vui lòng chờ admin xử lý`);

    ADMINS.forEach(aid => {
      bot.sendMessage(aid,
`📥 LỆNH RÚT MỚI

👤 ID: ${req.userId}
💰 ${req.amount.toLocaleString()} VND
🏧 ${req.info}
🕒 ${req.time}`);
    });
  }

  if (q.data === "cancel_withdraw") {
    user.step = null;
    mainMenu(chatId);
  }
});

/* ================== ADMIN COMMAND ================== */

// nạp tiền
bot.onText(/\/naptien (\d+) (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;
  initUser(m[1]);
  users[m[1]].balance += parseInt(m[2]);
  bot.sendMessage(m[1],
`🎉 Bạn được nạp ${parseInt(m[2]).toLocaleString()} VND`);
});

// danh sách rút
bot.onText(/\/danhsachrut/, (msg) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  if (withdrawRequests.length === 0)
    return bot.sendMessage(msg.chat.id, "📭 Không có lệnh rút nào");

  let text = "📋 DANH SÁCH RÚT TIỀN\n\n";
  withdrawRequests.forEach((r, i) => {
    text += `#${i + 1}
👤 ${r.userId}
💰 ${r.amount.toLocaleString()} VND
🏧 ${r.info}
🕒 ${r.time}

`;
  });

  bot.sendMessage(msg.chat.id, text);
});

// xác nhận rút
bot.onText(/\/xacnhanrut (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  const uid = parseInt(m[1]);
  const index = withdrawRequests.findIndex(r => r.userId === uid);
  if (index === -1)
    return bot.sendMessage(msg.chat.id, "❌ Không tìm thấy lệnh rút");

  withdrawRequests.splice(index, 1);

  bot.sendMessage(uid,
`🎉 THÔNG BÁO RÚT TIỀN THÀNH CÔNG

💰 Tiền đã được chuyển về tài khoản.
🏧 Vui lòng kiểm tra STK nhé!
Cảm ơn bạn đã tin tưởng 💎`);

  bot.sendMessage(msg.chat.id, `✅ Đã xác nhận rút cho user ${uid}`);
});

// thông báo đã về (nhanh)
bot.onText(/\/ruttien (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  bot.sendMessage(m[1],
`🎉 THÔNG BÁO RÚT TIỀN

💰 Số tiền bạn rút đã về tài khoản.
🏧 Vui lòng kiểm tra STK nhé!`);
});

/* ================== DICE ================== */
function roll() {
  return Math.floor(Math.random() * 6) + 1;
}
