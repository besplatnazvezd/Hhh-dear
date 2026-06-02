// api/webhook.js

module.exports = async (req, res) => {
    // Сразу отвечаем CryptoBot, что запрос получен (это важно, иначе он будет слать его повторно)
    res.status(200).send('OK');

    const { update_type, payload } = req.body || {};

    // Нас интересует только событие "Успешная оплата счета"
    if (update_type === 'invoice_paid' && payload) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const adminChatId = process.env.ADMIN_CHAT_ID;

        if (!botToken || !adminChatId) {
            console.error("TELEGRAM_BOT_TOKEN или ADMIN_CHAT_ID не настроены в Vercel!");
            return;
        }

        try {
            // Распаковываем данные заказа, которые мы сохранили ранее
            const order = JSON.parse(payload.payload);
            const rubAmount = parseFloat(payload.fiat_amount).toFixed(2);
            const usdtAmount = parseFloat(payload.amount).toFixed(2);

            // Формируем красивый список товаров
            const itemsFormatted = order.items.map(item => 
                `• ${item.n}\n  Количество: ${item.q} шт.\n  Пожелания/Данные: ${item.c || 'Не указаны'}`
            ).join('\n\n');

            // Сообщение для админа (тебя)
            const adminMessage = `✅ ЗАКАЗ УСПЕШНО ОПЛАЧЕН! [CRYPTOBOT]\n\n` +
                                 `👤 Клиент: @${order.u}\n` +
                                 `🆔 ID Клиента: ${order.id}\n` +
                                 `💵 Сумма: ${rubAmount} RUB (~${usdtAmount} USDT)\n\n` +
                                 `📦 СОСТАВ ЗАКАЗА:\n${itemsFormatted}`;

            // Отправляем сообщение тебе в Telegram через твоего бота
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: adminChatId,
                    text: adminMessage
                })
            });

            console.log("Сообщение об оплате успешно отправлено админу!");

        } catch (err) {
            console.error("Ошибка обработки вебхука заказа:", err);
        }
    }
};
