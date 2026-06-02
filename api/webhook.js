// api/webhook.js

module.exports = async (req, res) => {
    // Настройка CORS (на всякий случай)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { update_type, payload } = req.body || {};
    console.log("Получен вебхук от CryptoBot. Тип обновления:", update_type);

    // Нас интересует только событие "Успешная оплата счета"
    if (update_type === 'invoice_paid' && payload) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const adminChatId = process.env.ADMIN_CHAT_ID;

        if (!botToken || !adminChatId) {
            console.error("ОШИБКА: TELEGRAM_BOT_TOKEN или ADMIN_CHAT_ID не настроены в Vercel!");
            return res.status(500).json({ error: "Переменные окружения не настроены" });
        }

        try {
            // Распаковываем данные заказа
            const order = JSON.parse(payload.payload);
            const rubAmount = parseFloat(payload.fiat_amount).toFixed(2);
            const usdtAmount = parseFloat(payload.amount).toFixed(4);

            // Формируем красивый список товаров
            const itemsFormatted = order.items.map(item => 
                `• ${item.n}\n  Количество: ${item.q} шт.\n  Пожелания/Данные: ${item.c || 'Не указаны'}`
            ).join('\n\n');

            // Сообщение для тебя
            const adminMessage = `✅ ЗАКАЗ УСПЕШНО ОПЛАЧЕН! [CRYPTOBOT]\n\n` +
                                 `👤 Клиент: @${order.u}\n` +
                                 `🆔 ID Клиента: ${order.id}\n` +
                                 `💵 Сумма: ${rubAmount} RUB (~${usdtAmount} USDT)\n\n` +
                                 `📦 СОСТАВ ЗАКАЗА:\n${itemsFormatted}`;

            // ОТПРАВЛЯЕМ СООБЩЕНИЕ В ТЕЛЕГРАМ (Обязательно через await!)
            const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: adminChatId,
                    text: adminMessage
                })
            });

            const telegramResult = await telegramResponse.json();
            console.log("Ответ от Telegram API:", telegramResult);

            // ТЕПЕРЬ ОТВЕЧАЕМ OK В САМОМ КОНЦЕ
            return res.status(200).send('OK');

        } catch (err) {
            console.error("Критическая ошибка обработки вебхука:", err);
            return res.status(500).send('ERROR');
        }
    } else {
        // Если это был пустой запрос или проверка связи от CryptoBot
        return res.status(200).send('OK');
    }
};
