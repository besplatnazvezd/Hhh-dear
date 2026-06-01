// api/create-invoice.js

module.exports = async (req, res) => {
    // 1. Настройка CORS-заголовков, чтобы браузер не блокировал запросы к Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Если это предварительный запрос (OPTIONS) от браузера — сразу отвечаем успехом
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Логируем входящий запрос для дебага в панели Vercel
    console.log("--- ПОЛУЧЕН ЗАПРОС НА ОПЛАТУ ---");
    console.log("Тело запроса (сырое):", req.body);

    // Умный парсинг тела запроса (на случай, если данные пришли строкой)
    let body = {};
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (e) {
        console.error("Ошибка парсинга JSON:", e);
        return res.status(400).json({ error: "Некорректный формат отправленных данных" });
    }

    const { amount, description } = body;
    console.log("Распакованные данные:", { amount, description });

    // 2. Проверка токена в переменных Vercel
    const cryptoPayToken = process.env.CRYPTO_BOT_TOKEN; 
    if (!cryptoPayToken) {
        console.error("ОШИБКА: CRYPTO_BOT_TOKEN не найден в настройках Vercel!");
        return res.status(500).json({ error: "На сервере Vercel не настроен токен CRYPTO_BOT_TOKEN!" });
    }

    // 3. Проверка суммы
    if (!amount) {
        console.error("ОШИБКА: Не передана сумма заказа!");
        return res.status(400).json({ error: "Сумма заказа не указана!" });
    }

    try {
        // Округляем сумму до 2 знаков после запятой (CryptoBot требует строгий формат)
        const cryptoAmount = parseFloat(amount).toFixed(2);
        console.log(`Отправка запроса в CryptoBot API. Сумма: ${cryptoAmount} USDT`);

        // ИСПОЛЬЗУЕМ ОФИЦИАЛЬНЫЙ И БЕЗОПАСНЫЙ URL @CryptoBot
        const response = await fetch('https://pay.crypt.bot/api/createInvoice', {
            method: 'POST',
            headers: {
                'Crypto-Pay-API-Token': cryptoPayToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                asset: 'USDT', // Будем выставлять счета в долларах (USDT)
                fiat:  'RUB',
                amount: cryptoAmount.toString(),
                description: description || "Оплата в BOSS STORE",
                allow_comments: false,
                allow_anonymous: false
            })
        });

        const data = await response.json();
        console.log("Ответ от API CryptoBot:", data);

        if (data.ok) {
            console.log("Счет успешно создан! Ссылка на оплату:", data.result.pay_url);
            // Возвращаем ссылку обратно в наш WebApp
            return res.status(200).json({ pay_url: data.result.pay_url });
        } else {
            console.error("CryptoBot вернул ошибку API:", data.description);
            return res.status(400).json({ error: `CryptoBot API: ${data.description}` });
        }

    } catch (error) {
        console.error("Критическая ошибка выполнения скрипта:", error.message);
        return res.status(500).json({ error: "Внутренняя ошибка сервера: " + error.message });
    }
};
