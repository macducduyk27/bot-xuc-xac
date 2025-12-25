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
const withdrawHistory = []; // bảng thống kê rút tiền
function initUser(id) {
  if (!users[id]) {
    users[id] = {
      balance: 0,
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

function resetUserState(user) {
  user.step = null;
  user.choice = null;
  user.dices = [];
  user.playing = false;
  user.betAmount = 0;
  user.withdrawAmount = 0;
  user.withdrawInfo = "";
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
BOT chỉ có 1 ADMIN DUY NHẤT: @admxucxactele  
Ngoài tài khoản trên, tất cả đều là giả mạo.

🎁 ƯU ĐÃI NGƯỜI DÙNG MỚI
👉 Tặng ngay 20,000 VND
📩 Nhắn ngay @admxucxactele để nhận 20,000 VND tiền trải nghiệm.
👉 Chọn chức năng bên dưới để bắt đầu 🍀`
  );

  mainMenu(chatId);
});

/* ================== MESSAGE ================== */
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").replace(/,/g, '');
  initUser(chatId);
  const user = users[chatId];

  if (text === "👤 Thông tin cá nhân") {
    return bot.sendMessage(chatId,
`👤 ID: ${chatId}
💰 Số dư: ${user.balance.toLocaleString()} VND`);
  }

  if (text === "💳 Nạp tiền") {
  return bot.sendMessage(chatId,
`👉 Liên hệ admin: @admxucxactele để nạp tiền vào BOT
Trả lời 24/24. Khi nhắn báo số tiền muốn nạp luôn để tránh mất thời gian.`);
}

  if (text === "💰 Số dư") {
    return bot.sendMessage(chatId,
`💰 ${user.balance.toLocaleString()} VND`);
  }

  /* ===== RÚT TIỀN ===== */
  if (text === "💸 Rút tiền") {
    user.step = "withdraw_amount";
    return bot.sendMessage(chatId,
`✅ Số Tiền Rút Tối Thiểu Là: 100,000 VND

🏧 Bạn nhập số tiền rút ở dưới nha
Ví dụ: rút 100,000 VND sẽ nhập 100000`);
  }

  if (user.step === "withdraw_amount") {
    const amount = parseInt(text);
    if (isNaN(amount) || amount < 100000) return bot.sendMessage(chatId, "❌ Số tiền rút tối thiểu 100,000 VND");
    if (amount > user.balance) return bot.sendMessage(chatId, "❌ Số dư không đủ");

    user.withdrawAmount = amount;
    user.step = "withdraw_info";

    return bot.sendMessage(chatId,
`Bạn vui lòng nhập:
tên ngân hàng + họ và tên + STK

✅ Ví dụ:
Vietcombank N.V.A 123456789`);
  }

  if (user.step === "withdraw_info") {
    user.withdrawInfo = text;
    user.step = "withdraw_confirm";

    return bot.sendMessage(chatId,
`Bạn có chắc chắn rút: ${user.withdrawAmount.toLocaleString()} đ

❎ Lưu ý: Chỉ Nhấn Nút Để Thực Hiện`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Chắc chắn", callback_data: "confirm_withdraw" }],
          [{ text: "❌ Huỷ lệnh", callback_data: "cancel_withdraw" }]
        ]
      }
    });
  }

  /* ===== START GAME ===== */
  if (text === "🎲 Game xúc xắc") {
    resetUserState(user); // reset mọi state cũ
    user.step = "bet";   // bước đặt cược mới
    return bot.sendMessage(chatId,
`💵 NHẬP TIỀN CƯỢC
📌 VD: 10,000 → nhập 10000
(min 5,000 – không giới hạn)`, {
      reply_markup: { remove_keyboard: true }
    });
  }

  if (user.step === "bet") {
    const amount = parseInt(text);
    if (isNaN(amount) || amount < 5000)
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

/* ================== CALLBACK ================== */
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  initUser(chatId);
  const user = users[chatId];

  // ===== Chọn cửa game =====
if ((q.data === "small" || q.data === "big")) {
    if (user.choice) {
        // Nếu đã chọn rồi → không cho thay đổi
        return bot.answerCallbackQuery(q.id, { text: "❌ Bạn đã chọn cửa rồi, không thể thay đổi!", show_alert: true });
    }

    // Chọn lần đầu → chấp nhận
    user.choice = q.data;
    user.dices = [];
    user.playing = true;
    user.step = "roll"; // bước roll xúc xắc

    return bot.sendMessage(chatId, "🎲 BẤM NÚT DƯỚI ĐỂ XÚC (3 LẦN)", {
        reply_markup: {
            inline_keyboard: [[{ text: "🎲 Xúc", callback_data: "roll_dice" }]]
        }
    });
}

  // ===== Xúc xúc xắc =====
  if (q.data === "roll_dice" && user.playing) {
    const dice = await bot.sendDice(chatId);
    user.dices.push(dice.dice.value);

    if (user.dices.length < 3) {
      return bot.sendMessage(chatId, `🎲 Đã xúc ${user.dices.length}/3\n👉 Bấm 🎲 Xúc tiếp`, {
        reply_markup: {
          inline_keyboard: [[{ text: "🎲 Xúc tiếp", callback_data: "roll_dice" }]]
        }
      });
    }

    const total = user.dices.reduce((a, b) => a + b, 0);
    const win = (user.choice === "small" && total <= 10) || (user.choice === "big" && total >= 11);
    let change = user.betAmount;
user.balance += win ? change : -change;

    // Gửi kết quả cho user
    await bot.sendMessage(chatId,
`🎲 KẾT QUẢ XÚC XẮC
👤 ID: ${chatId}
🎯 Cửa: ${win ? "Thắng" : "Thua"}
📊 Kết quả: ${win ? "+" : "-"} ${change.toLocaleString()} VND
💰 Số dư: ${user.balance.toLocaleString()} VND
Tổng điểm: ${total}`);

    // Gửi log cho admin
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

    resetUserState(user);
    return mainMenu(chatId);
  }

  // ===== Xác nhận rút tiền =====
  if (q.data === "confirm_withdraw") {
    withdrawRequests.push({
      id: chatId,
      amount: user.withdrawAmount,
      info: user.withdrawInfo,
      status: "pending"
    });
    user.balance -= user.withdrawAmount;

    await bot.editMessageText(`✅ Hệ thống đã ghi nhận đơn rút tiền của bạn
👉 Bạn vui lòng đợi trong giây lát, chúng tôi sẽ tiến hành chuyển tiền cho bạn`, {
      chat_id: chatId,
      message_id: q.message.message_id
    });

    ADMINS.forEach(aid => {
      bot.sendMessage(aid,
`📢 YÊU CẦU RÚT TIỀN
👤 ID: ${chatId}
💰 Số tiền: ${user.withdrawAmount.toLocaleString()} VND
🏧 Ngân hàng & STK: ${user.withdrawInfo}`);
    });

    resetUserState(user);
    return mainMenu(chatId);
  }

  if (q.data === "cancel_withdraw") {
    await bot.editMessageText(`❌ Bạn đã huỷ yêu cầu rút tiền`, {
      chat_id: chatId,
      message_id: q.message.message_id
    });
    resetUserState(user);
    return mainMenu(chatId);
  }
});

/* ================== LỆNH ADMIN NẠP TIỀN ================== */
bot.onText(/\/naptien (\d+) (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  const userId = parseInt(m[1]);
  const amount = parseInt(m[2]);

  initUser(userId);
  users[userId].balance += amount;

  bot.sendMessage(userId,
`🎉 Bạn được nạp ${amount.toLocaleString()} VND`);

  bot.sendMessage(msg.chat.id,
`✅ Đã nạp tiền cho ID ${userId}`);
});

/* ================== ADMIN RÚT TIỀN ================== */
bot.onText(/\/ruttien (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  const userId = parseInt(m[1]);
  const reqIndex = withdrawRequests.findIndex(r => r.id === userId && r.status === "pending");
  if (reqIndex === -1) return bot.sendMessage(msg.chat.id, "❌ Không tìm thấy yêu cầu rút tiền");

  const req = withdrawRequests[reqIndex];
  req.status = "done";
  withdrawHistory.push({
  userId: userId,
  amount: req.amount,
  info: req.info,
  time: new Date().toLocaleString("vi-VN")
});

  bot.sendMessage(userId,
`🎊 Chúc mừng 🎊
🏧 Số Tiền: ${req.amount.toLocaleString()} VND đã được gửi đến tài khoản của bạn
Bạn kiểm tra tài khoản xem nhé`);

  bot.sendMessage(msg.chat.id, `✅ Đã thực hiện rút tiền cho ID ${userId}`);
});
/* ================== BẢNG THỐNG KÊ RÚT ================== */
bot.onText(/\/bangrut/, (msg) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  if (withdrawHistory.length === 0) {
    return bot.sendMessage(msg.chat.id, "📭 Chưa có lịch sử rút tiền nào");
  }

  let text = "📊 BẢNG THỐNG KÊ RÚT TIỀN\n\n";

  withdrawHistory.slice(-20).forEach((w, i) => {
    text += `${i + 1}. 👤 ID: ${w.userId}
💰 Số tiền: ${w.amount.toLocaleString()} VND
🏧 ${w.info}
⏰ ${w.time}\n\n`;
  });

  bot.sendMessage(msg.chat.id, text);
});
/* ================== ĐƠN RÚT CHỜ DUYỆT ================== */
bot.onText(/\/rutcho/, (msg) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  const pending = withdrawRequests.filter(r => r.status === "pending");

  if (pending.length === 0) {
    return bot.sendMessage(msg.chat.id, "📭 Không có lệnh rút nào đang chờ duyệt");
  }

  let text = "⏳ DANH SÁCH RÚT TIỀN CHỜ DUYỆT\n\n";

  pending.forEach((r, i) => {
    text += `${i + 1}. 👤 ID: ${r.id}
💰 Số tiền: ${r.amount.toLocaleString()} VND
🏧 ${r.info}
📌 Trạng thái: CHỜ DUYỆT\n\n`;
  });

  bot.sendMessage(msg.chat.id, text);
});