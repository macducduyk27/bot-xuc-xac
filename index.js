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

  // Gửi tin nhắn chào mừng
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
`✅ Số Tiền Rút Tối Thiểu Là: 50000 vnđ

🏧 Bạn nhập số tiền rút ở dưới nha
Ví dụ: rút 50,000VND sẽ nhập 50000`);
}

if (user.step === "withdraw_amount") {
  const amount = parseInt(text);
  if (isNaN(amount) || amount < 50000) return bot.sendMessage(chatId, "❌ Số tiền rút tối thiểu 50,000 VND");
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
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const user = users[chatId];

  /* ===== Chọn cửa game ===== */
  if (q.data === "small" || q.data === "big") {
    user.choice = q.data;
    user.dices = [];
    user.playing = true;

    return bot.sendMessage(chatId,
      "🎲 BẤM NÚT DƯỚI ĐỂ XÚC (3 LẦN)", {
        reply_markup: {
          inline_keyboard: [[{ text: "🎲 Xúc", callback_data: "roll_dice" }]]
        }
      }
    );
  }

  /* ===== Xúc xúc xắc ===== */
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

    // Kết quả
    const total = user.dices.reduce((a, b) => a + b, 0);
    const win = (user.choice === "small" && total <= 10) || (user.choice === "big" && total >= 11);
    let change;
    if (win) {
      change = Math.floor(user.betAmount * HOUSE_RATE);
      user.balance += change;
    } else {
      change = user.betAmount;
      user.balance -= change;
    }

    // Reset trạng thái game
    user.playing = false;
    user.dices = [];
    user.step = null;
    user.choice = null;

    // Hiển thị kết quả theo yêu cầu
    await bot.sendMessage(chatId,
`🎲 KẾT QUẢ XÚC XẮC
👤 ID: ${chatId}
🎯 Cửa: ${win ? "Thắng" : "Thua"}
💰 Số dư: ${user.balance.toLocaleString()} VND
Tổng điểm: ${total}`);

    return mainMenu(chatId);
  }

  /* ===== Xác nhận rút tiền ===== */
  if (q.data === "confirm_withdraw") {
    // Trừ tiền và lưu yêu cầu
    user.balance -= user.withdrawAmount;
    withdrawRequests.push({
      id: chatId,
      amount: user.withdrawAmount,
      info: user.withdrawInfo,
      status: "pending"
    });
    user.step = null;

    await bot.editMessageText(`✅ Hệ thống đã ghi nhận đơn rút tiền của bạn

👉 Bạn vui lòng đợi trong giây lát, chúng tôi sẽ tiến hành chuyển tiền cho bạn`, {
      chat_id: chatId,
      message_id: q.message.message_id
    });

    return mainMenu(chatId);
  }

  if (q.data === "cancel_withdraw") {
    user.step = null;
    await bot.editMessageText(`❌ Bạn đã huỷ yêu cầu rút tiền`, {
      chat_id: chatId,
      message_id: q.message.message_id
    });
    return mainMenu(chatId);
  }
});
bot.onText(/\/ruttien (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  const userId = parseInt(m[1]);
  const reqIndex = withdrawRequests.findIndex(r => r.id === userId && r.status === "pending");
  if (reqIndex === -1) return bot.sendMessage(msg.chat.id, "❌ Không tìm thấy yêu cầu rút tiền");

  const req = withdrawRequests[reqIndex];
  req.status = "done";

  bot.sendMessage(userId,
`🎊 Chúc mừng 🎊
🏧 Số Tiền: ${req.amount.toLocaleString()} VND đã được gửi đến tài khoản của bạn
Bạn kiểm tra tài khoản xem nhé`);

  bot.sendMessage(msg.chat.id, `✅ Đã thực hiện rút tiền cho ID ${userId}`);
});