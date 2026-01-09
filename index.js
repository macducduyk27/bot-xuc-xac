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
const giftCodes = {};
const withdrawRequests = [];
const withdrawHistory = [];

function initUser(id) {
  if (!users[id]) {
    users[id] = {
      balance: 0,
      bonusBalance: 0,
      betTurnover: 0,
      needTurnover: 0,
      usedCodes: [],
      step: null,
      game: null,         // "xucxac" hoặc "chanle"
      betAmount: 0,
      choice: null,
      dices: [],
      playing: false,
      withdrawAmount: 0,
      withdrawInfo: "",
      refBy: null,     // 👈 thêm
      invited: [],     // 👈 thêm
      hasBet: false
    };
  }
}

function resetUserState(user) {
  user.step = null;
  user.game = null;
  user.betAmount = 0;
  user.choice = null;
  user.dices = [];
  user.playing = false;
  user.withdrawAmount = 0;
  user.withdrawInfo = "";
}

/* ================== MENU ================== */
function mainMenu(chatId) {
  bot.sendMessage(chatId, "🎮 MENU CHÍNH", {
    reply_markup: {
      keyboard: [
        ["👤 Thông tin cá nhân"],
        ["🎲 Game Tài Xỉu", "🎲 Game Chẵn Lẻ"],
        ["💳 Nạp tiền"],
        ["💰 Số dư", "💸 Rút tiền"],
        ["🤝 Mời bạn bè"]
      ],
      resize_keyboard: true
    }
  });
}

/* ================== START ================== */
bot.onText(/\/start(?: (\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const refId = match[1];

  initUser(chatId);
  const user = users[chatId];

  // ghi nhận người mời
  if (refId && refId !== chatId.toString() && !user.refBy) {
    user.refBy = refId;
  }

  bot.sendMessage(chatId,
`🎉 CHÀO MỪNG BẠN ĐẾN VỚI BOT GAME 🎉

🎲 2 GAME MINH BẠCH – CÔNG BẰNG
1️⃣ Tài Xỉu (3 viên)
2️⃣ Chẵn / Lẻ (1 viên)
💰 Thắng thua cập nhật số dư tức thì
🔒 Hệ thống tự động – bảo mật

🎁 ƯU ĐÃI NGƯỜI DÙNG MỚI
👉 Tặng ngay 30,000 VND
📩 Nhắn trong BOT: /code 30ktrainghiem
   Sẽ được cộng trực tiếp để tham gia trò chơi.
  

📌 Gõ /huongdanchoi để xem hướng dẫn chi tiết
📌 Gõ /uudai để xem ưu đãi
`);
  mainMenu(chatId);
});
bot.onText(/\/code (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const code = match[1].toUpperCase();

  initUser(chatId);
  const user = users[chatId];

  if (!giftCodes[code])
    return bot.sendMessage(chatId, "❌ Mã không tồn tại");

  if (user.usedCodes.includes(code))
    return bot.sendMessage(chatId, "❌ Bạn đã dùng mã này rồi");

  const amount = giftCodes[code].amount;

  user.balance += amount;
  user.bonusBalance += amount;
  user.needTurnover += amount * 10;
  user.usedCodes.push(code);

  bot.sendMessage(chatId,
`🎉 Nhập code thành công
💰 +${amount.toLocaleString()} VND`);
});

/* ================== MESSAGE HANDLER ================== */
function rewardReferral(userId) {
  const user = users[userId];
  if (!user || user.hasBet) return;

  user.hasBet = true;

  if (user.refBy) {
    initUser(user.refBy);
    users[user.refBy].balance += 3000;

    bot.sendMessage(user.refBy,
`🎉 Bạn được +3,000 VND vì mời bạn thành công
👤 ID: ${userId}`);
  }
}
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").replace(/,/g, '');
  initUser(chatId);
  const user = users[chatId];
  
    // ⛔ XỬ LÝ HUỶ RÚT TIỀN (ĐẶT Ở ĐÂY)
  if (text === "❌ Huỷ" && user.step && user.step.startsWith("withdraw")) {
    resetUserState(user);
    bot.sendMessage(chatId, "❌ Đã huỷ rút tiền");
    return mainMenu(chatId);
  }

  // ⛔ CHẶN BẤM MENU KHÁC KHI ĐANG RÚT
  if (user.step === "withdraw_amount" && text !== "❌ Huỷ" && !/^\d+$/.test(text)) {
    return bot.sendMessage(chatId,
      "❗ Vui lòng nhập số tiền muốn rút hoặc bấm ❌ Huỷ"
    );
  }
  
if (text === "🤝 Mời bạn bè") {
  const link = `https://t.me/xucxac_vn_bot?start=${chatId}`;
  return bot.sendMessage(chatId,
`🤝 MỜI BẠN BÈ

🔗 Link mời của bạn:
${link}

🎁 Thưởng mời bạn bè: +3,000 VND  
Áp dụng khi người được mời tham gia qua link và đặt cược lần đầu (không cần nạp, dùng 30,000 VND trải nghiệm).  
📩 Nhắn @admxucxactele để nhận ưu đãi.
 `);
}
  /* ===== THÔNG TIN & SỐ DƯ ===== */
  if (text === "👤 Thông tin cá nhân") {
    return bot.sendMessage(chatId,
`👤 ID: ${chatId}
💰 Số dư: ${user.balance.toLocaleString()} VND`);
  }
  if (text === "💰 Số dư") {
    return bot.sendMessage(chatId, `💰 ${user.balance.toLocaleString()} VND`);
  }

  /* ===== NẠP TIỀN ===== */
  if (text === "💳 Nạp tiền") {
    return bot.sendMessage(chatId, `📩 Liên hệ admin: @admxucxactele để nạp tiền`);
  }

  /* ===== RÚT TIỀN ===== */
  if (text === "💸 Rút tiền") {
  user.step = "withdraw_amount";
  return bot.sendMessage(chatId,
`✅ Số tiền rút tối thiểu: 200,000 VND
🏧 Nhập số tiền muốn rút (vd: 200000)
❌ Gõ Huỷ để quay lại menu`, {
    reply_markup: {
      keyboard: [["❌ Huỷ"]],
      resize_keyboard: true
    }
  if (user.step === "withdraw_amount") {
      // 🚫 CHẶN RÚT NẾU CHƯA CƯỢC ĐỦ X10
  if (user.betTurnover < user.needTurnover) {
    return bot.sendMessage(chatId,
`❌ Chưa đủ điều kiện rút
📊 Đã cược: ${user.betTurnover.toLocaleString()}
🎯 Còn thiếu: ${(user.needTurnover - user.betTurnover).toLocaleString()}`);
  }
    const amount = parseInt(text);
    if (isNaN(amount) || amount < 200000) return bot.sendMessage(chatId, "❌ Số tiền rút tối thiểu 200,000 VND");
    if (amount > user.balance) return bot.sendMessage(chatId, "❌ Số dư không đủ");

    user.withdrawAmount = amount;
    user.step = "withdraw_info";
    return bot.sendMessage(chatId,
`Nhập: Tên ngân hàng + Họ tên + STK
Ví dụ: Vietcombank N.V.A 123456789`);
  }
  if (user.step === "withdraw_info") {
    user.withdrawInfo = text;
    user.step = "withdraw_confirm";
    return bot.sendMessage(chatId,
`❗ Xác nhận rút tiền: ${user.withdrawAmount.toLocaleString()} VND`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Chắc chắn", callback_data: "confirm_withdraw" }],
          [{ text: "❌ Huỷ", callback_data: "cancel_withdraw" }]
        ]
      }
    });
  }

  /* ===== CHỌN GAME ===== */
if (text === "🎲 Game Tài Xỉu") {
    initUser(chatId);

    if (user.balance < 5000) {
        return bot.sendMessage(chatId, 
`❌ Bạn không đủ tiền để chơi!
👉 Hãy liên hệ @admxucxactele để nạp tiền`);
    }

    resetUserState(user);
    user.game = "xucxac";       // đặt game
    user.step = "bet_xucxac";   // bước nhập cược
    return bot.sendMessage(chatId,
`💵 NHẬP TIỀN CƯỢC
📌 VD: 10,000 → nhập 10000
(min 5,000 – không giới hạn)`);
}

if (text === "🎲 Game Chẵn Lẻ") {
    initUser(chatId);

    if (user.balance < 5000) {
        return bot.sendMessage(chatId, 
`❌ Bạn không đủ tiền để chơi!
👉 Hãy liên hệ @admxucxactele để nạp tiền`);
    }

    resetUserState(user);
    user.game = "chanle";       // đặt game
    user.step = "bet_chanle";   // bước nhập cược
    return bot.sendMessage(chatId,
`💵 NHẬP TIỀN CƯỢC
Tối thiểu 5,000 VND`);
}

  /* ===== BET XÚC XẮC ===== */
  if (user.step === "bet_xucxac") {
    if (!/^\d+$/.test(text)) return;
    const amount = parseInt(text);
    if (amount < 5000) return bot.sendMessage(chatId, "❌ Cược tối thiểu 5,000");
    if (amount > user.balance) return bot.sendMessage(chatId, "❌ Số dư không đủ");
    
    user.betAmount = amount;
    user.betTurnover += amount;
    rewardReferral(chatId);
    user.step = "choose_xucxac";
    return bot.sendMessage(chatId, "👉 Chọn cửa", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔽 Nhỏ (3–10)", callback_data: "small" }],
          [{ text: "🔼 Lớn (11–18)", callback_data: "big" }]
        ]
      }
    });
  }

  /* ===== BET CHẴN LẺ ===== */
  if (user.step === "bet_chanle") {
    if (!/^\d+$/.test(text)) return;
    const amount = parseInt(text);
    if (amount < 5000) return bot.sendMessage(chatId, "❌ Cược tối thiểu 5,000");
    if (amount > user.balance) return bot.sendMessage(chatId, "❌ Số dư không đủ");
    
    user.betAmount = amount;
    user.betTurnover += amount;
    rewardReferral(chatId);
    
    user.step = "choose_chanle";
    return bot.sendMessage(chatId, "👉 Chọn cửa", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⚪ CHẴN (2-4-6)", callback_data: "even" }],
          [{ text: "⚫ LẺ (1-3-5)", callback_data: "odd" }]
        ]
      }
    });
  }

  if (text === "🏠 Menu chính") return mainMenu(chatId);
});

/* ================== CALLBACK ================== */
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  initUser(chatId);
  const user = users[chatId];

  /* ===== XÁC NHẬN RÚT TIỀN ===== */
  if (q.data === "confirm_withdraw") {
    withdrawRequests.push({
      id: chatId,
      amount: user.withdrawAmount,
      info: user.withdrawInfo,
      status: "pending"
    });
    user.balance -= user.withdrawAmount;

    await bot.editMessageText(`✅ Đã ghi nhận yêu cầu rút tiền`, {
      chat_id: chatId,
      message_id: q.message.message_id
    });

    ADMINS.forEach(aid => {
      bot.sendMessage(aid,
`📢 YÊU CẦU RÚT TIỀN
👤 ID: ${chatId}
💰 ${user.withdrawAmount.toLocaleString()} VND
🏧 ${user.withdrawInfo}`);
    });

    resetUserState(user);
    return mainMenu(chatId);
  }
  if (q.data === "cancel_withdraw") {
    await bot.editMessageText(`❌ Huỷ yêu cầu rút tiền`, {
      chat_id: chatId,
      message_id: q.message.message_id
    });
    resetUserState(user);
    return mainMenu(chatId);
  }

  /* ===== CALLBACK XÚC XẮC ===== */
  if (user.game === "xucxac") {
    if (q.data === "small" || q.data === "big") {
      if (user.choice) return bot.answerCallbackQuery(q.id, { text: "❌ Đã chọn rồi", show_alert: true });

      user.choice = q.data;
      user.dices = [];
      user.playing = true;
      user.step = "roll_xucxac";

      return bot.sendMessage(chatId, "🎲 BẤM NÚT DƯỚI ĐỂ XÚC (3 lần)", {
        reply_markup: {
          inline_keyboard: [[{ text: "🎲 Xúc", callback_data: "roll_xucxac" }]]
        }
      });
    }

    if (q.data === "roll_xucxac" && user.playing) {
      const dice = await bot.sendDice(chatId);
      user.dices.push(dice.dice.value);

      if (user.dices.length < 3) {
        return bot.sendMessage(chatId, `🎲 Đã xúc ${user.dices.length}/3\n👉 Bấm tiếp`, {
          reply_markup: {
            inline_keyboard: [[{ text: "🎲 Xúc tiếp", callback_data: "roll_xucxac" }]]
          }
        });
      }

      const total = user.dices.reduce((a,b)=>a+b,0);
      const win = (user.choice === "small" && total <= 10) || (user.choice === "big" && total >= 11);
      const change = user.betAmount;
      user.balance += win ? change : -change;

      await bot.sendMessage(chatId,
`🎲 KẾT QUẢ XÚC XẮC
👤 ID: ${chatId}
🎯 Cửa: ${win ? "Thắng" : "Thua"}
📊 Kết quả: ${win ? "+" : "-"} ${change.toLocaleString()} VND
💰 Số dư: ${user.balance.toLocaleString()}
Tổng điểm: ${total}`);

      ADMINS.forEach(aid => {
        bot.sendMessage(aid,
`📊 LOG XÚC XẮC
👤 ID USER: ${chatId}
💵 Tiền cược: ${user.betAmount}
🎯 Cửa: ${user.choice}
🎲 Tổng điểm: ${total}
💰 Dư còn lại: ${user.balance}`);
      });

      resetUserState(user);
      return mainMenu(chatId);
    }
  }

  /* ===== CALLBACK CHẴN LẺ ===== */
  if (user.game === "chanle") {
    if (q.data === "even" || q.data === "odd") {
      if (user.choice) return bot.answerCallbackQuery(q.id, { text: "❌ Đã chọn rồi", show_alert: true });

      user.choice = q.data;
      user.playing = true;
      user.step = "roll_chanle";

      return bot.sendMessage(chatId, "🎲 BẤM NÚT DƯỚI ĐỂ XÚC", {
        reply_markup: {
          inline_keyboard: [[{ text: "🎲 Xúc", callback_data: "roll_chanle" }]]
        }
      });
    }

    if (q.data === "roll_chanle" && user.playing) {
      const dice = await bot.sendDice(chatId);
      const value = dice.dice.value;
      const isEven = value % 2 === 0;
      const win = (user.choice === "even" && isEven) || (user.choice === "odd" && !isEven);
      const change = user.betAmount;
      user.balance += win ? change : -change;

      await bot.sendMessage(chatId,
`🎲 KẾT QUẢ CHẴN / LẺ
🎯 Xúc: ${value}
📌 Bạn chọn: ${user.choice === "even" ? "CHẴN" : "LẺ"}
🏆 Kết quả: ${win ? "THẮNG" : "THUA"}
💰 ${win ? "+" : "-"}${change.toLocaleString()} VND
💳 Số dư: ${user.balance.toLocaleString()}`);

      ADMINS.forEach(aid => {
        bot.sendMessage(aid,
`📊 LOG CHẴN LẺ
👤 ID: ${chatId}
🎲 Xúc: ${value}
🎯 Cửa: ${user.choice}
💰 ${win ? "+" : "-"}${change.toLocaleString()}
💳 Dư: ${user.balance}`);
      });
      rewardReferral(chatId);
      resetUserState(user);
      return mainMenu(chatId);
    }
  }
});

/* ================== ADMIN NẠP / RÚT / BẢNG ================== */
bot.onText(/\/naptien (\d+) (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;
  const uid = parseInt(m[1]);
  const amount = parseInt(m[2]);
  initUser(uid);
  users[uid].balance += amount;
  bot.sendMessage(uid, `🎉 Bạn được nạp ${amount.toLocaleString()} VND`);
  bot.sendMessage(msg.chat.id, `✅ Nạp thành công cho ID ${uid}`);
});

bot.onText(/\/ruttien (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;
  const uid = parseInt(m[1]);
  const reqIndex = withdrawRequests.findIndex(r => r.id === uid && r.status === "pending");
  if (reqIndex === -1) return bot.sendMessage(msg.chat.id, "❌ Không tìm thấy yêu cầu rút tiền");

  const req = withdrawRequests[reqIndex];
  req.status = "done";
  withdrawHistory.push(req);
  withdrawRequests.splice(reqIndex, 1);

  bot.sendMessage(uid,
`🎉 Yêu cầu rút tiền đã xử lý
💰 ${req.amount.toLocaleString()} VND
🏧 ${req.info}`);
  bot.sendMessage(msg.chat.id, `✅ Đã duyệt rút tiền user ${uid}`);
});

bot.onText(/\/bangrut/, (msg) => {
  if (!ADMINS.includes(msg.chat.id)) return;
  if (withdrawHistory.length === 0) return bot.sendMessage(msg.chat.id, "📭 Chưa có lịch sử rút tiền");
  let text = "📊 BẢNG THỐNG KÊ RÚT TIỀN\n\n";
  withdrawHistory.slice(-20).forEach((w, i) => {
    text += `${i+1}. 👤 ID: ${w.userId}\n💰 ${w.amount.toLocaleString()} VND\n🏧 ${w.info}\n⏰ ${w.time}\n\n`;
  });
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/tuchoirut (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  const uid = parseInt(m[1]);
  const index = withdrawRequests.findIndex(r => r.id === uid);

  if (index === -1)
    return bot.sendMessage(msg.chat.id, "❌ Không tìm thấy yêu cầu");

  const req = withdrawRequests[index];
  initUser(uid);
  users[uid].balance += req.amount;
  withdrawRequests.splice(index, 1);

  bot.sendMessage(uid,
`❌ Yêu cầu rút tiền bị từ chối
💰 ${req.amount.toLocaleString()} VND đã hoàn lại`);

  bot.sendMessage(msg.chat.id, `✅ Đã hoàn tiền user ${uid}`);
});
bot.onText(/\/taocode (\w+) (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  const code = m[1].toUpperCase();
  const amount = parseInt(m[2]);

  giftCodes[code] = { amount };

  bot.sendMessage(msg.chat.id,
`✅ Đã tạo code ${code}
💰 ${amount.toLocaleString()} VND`);
});
bot.onText(/\/boquacuoc (\d+)/, (msg, match) => {
  if (!ADMINS.includes(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, "❌ Bạn không phải admin");
  }

  const uid = parseInt(match[1]);
  if (!users[uid]) {
    return bot.sendMessage(msg.chat.id, "❌ User không tồn tại");
  }

  const user = users[uid];

  // huỷ yêu cầu cược
  user.needTurnover = 0;
  user.betTurnover = 0;
  user.bonusBalance = 0;

  bot.sendMessage(msg.chat.id,
`✅ Đã bỏ yêu cầu cược cho user ${uid}`);

  bot.sendMessage(uid,
`🎉 ADMIN đã huỷ điều kiện cược`);
});
/* ================== HƯỚNG DẪN & ƯU ĐÃI ================== */
bot.onText(/\/huongdanchoi/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
`📘 HƯỚNG DẪN CHƠI

🎲 GAME XÚC XẮC
1️⃣ Chọn "🎲 Game Xúc Xắc"
2️⃣ Nhập tiền cược
3️⃣ Chọn cửa: 🔽 Nhỏ / 🔼 Lớn
4️⃣ Xúc 3 lần → Tổng điểm quyết định thắng / thua

🎲 GAME CHẴN LẺ
1️⃣ Chọn "🎲 Game Chẵn Lẻ"
2️⃣ Nhập tiền cược
3️⃣ Chọn cửa: ⚪ CHẴN / ⚫ LẺ
4️⃣ Xúc 1 lần → Chẵn / Lẻ quyết định thắng / thua

💰 Thắng / Thua: tiền cược được cộng / trừ ngay
💸 Rút tiền: tối thiểu 200,000 VND
🎁 Ưu đãi: tặng 30,000 VND cho người mới`);
});

bot.onText(/\/uudai/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
`🎁 ƯU ĐÃI BOT

🎉 Người mới: tặng 30,000 VND
💰 Nạp lần đầu: +50% số tiền
📩 Nhắn @admxucxactele để nhận ưu đãi
🕘 Online 24/24`);
});