// api/create-invoice.js

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    console.log("--- ПОЛУЧЕН ЗАПРОС НА ОПЛАТУ ---");

    let body = {};
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (e) {
        console.error("Ошибка парсинга JSON:", e);
        return res.status(400).json({ error: "Некорректный формат отправленных данных" });
    }

    const { amount, userId, username, items } = body;
    const cryptoPayToken = process.env.CRYPTO_BOT_TOKEN; 

    if (!cryptoPayToken) {
        return res.status(500).json({ error: "На сервере Vercel не настроен токен CRYPTO_BOT_TOKEN!" });
    }

    if (!amount) {
        return res.status(400).json({ error: "Сумма заказа не указана!" });
    }

    try {
        const rubAmount = parseFloat(amount);
        console.log(`Исходная сумма в рублях: ${rubAmount} RUB`);

        // 1. ПОЛУЧАЕМ АКТУАЛЬНЫЙ КУРС ОБМЕНА ОТ CRYPTOBOT
        let usdtToRubRate = 94.0; // Резервный курс на случай сбоя
        try {
            const ratesResponse = await fetch('https://pay.crypt.bot/api/getExchangeRates', {
                headers: { 'Crypto-Pay-API-Token': cryptoPayToken }
            });
            const ratesData = await ratesResponse.json();
            
            if (ratesData.ok && ratesData.result) {
                const pair = ratesData.result.find(r => r.source === 'USDT' && r.target === 'RUB' && r.is_valid);
                if (pair) {
                    usdtToRubRate = parseFloat(pair.rate);
                    console.log(`Текущий официальный курс USDT/RUB: ${usdtToRubRate}`);
                }
            }
        } catch (rateErr) {
            console.error("Не удалось получить курс обмена, используем резервный:", rateErr);
        }

        // 2. КОНВЕРТИРУЕМ РУБЛИ В USDT (чтобы обойти ASSET_REQUIRED)
        const usdtAmount = (rubAmount / usdtToRubRate).toFixed(4); // 4 знака для точности
        console.log(`Итоговая сумма к оплате: ${usdtAmount} USDT`);

        // 3. Упаковываем данные заказа для вебхука
        const orderPayload = JSON.stringify({
            u: username || "Не указан",
            id: userId || "Не указан",
            items: items ? items.map(i => ({ n: i.name, q: i.qty, c: i.comment })) : []
        });

        // 4. СОЗДАЕМ СЧЕТ С ОБЯЗАТЕЛЬНЫМ ПАРАМЕТРОМ ASSET
        const response = await fetch('https://pay.crypt.bot/api/createInvoice', {
            method: 'POST',
            headers: {
                'Crypto-Pay-API-Token': cryptoPayToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                asset: 'USDT', // Передаем напрямую крипту! Это решает проблему ASSET_REQUIRED
                amount: usdtAmount.toString(),
                description: `Оплата BOSS STORE | Курс: 1$ ~ ${usdtToRubRate.toFixed(2)}₽`,
                payload: orderPayload, // Сохраняем пакет данных для вебхука
                allow_comments: false,
                allow_anonymous: false
            })
        });

        const data = await response.json();
        console.log("Ответ от API CryptoBot:", data);

        if (data.ok) {
            return res.status(200).json({ pay_url: data.result.pay_url });
        } else {
            const errName = data.error ? (data.error.name || data.error.code) : "UNKNOWN_ERROR";
            return res.status(400).json({ error: `CryptoBot API: ${errName}` });
        }

    } catch (error) {
        return res.status(500).json({ error: "Внутренняя ошибка сервера: " + error.message });
    }
};
