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

    const { amount, description } = body;
    const cryptoPayToken = process.env.CRYPTO_BOT_TOKEN; 

    if (!cryptoPayToken) {
        return res.status(500).json({ error: "На сервере Vercel не настроен токен CRYPTO_BOT_TOKEN!" });
    }

    if (!amount) {
        return res.status(400).json({ error: "Сумма заказа не указана!" });
    }

    try {
        // Округляем до 2 знаков
        const cryptoAmount = parseFloat(amount).toFixed(2);
        console.log(`Отправка запроса в CryptoBot API. Сумма: ${cryptoAmount} RUB`);

        const response = await fetch('https://pay.crypt.bot/api/createInvoice', {
            method: 'POST',
            headers: {
                'Crypto-Pay-API-Token': cryptoPayToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fiat: 'RUB',   // Выставляем счет в Рублях
                accepted_assets: 'USDT', // Клиент платит в USDT
                amount: cryptoAmount.toString(),
                description: description || "Оплата в BOSS STORE",
                allow_comments: false,
                allow_anonymous: false
            })
        });

        const data = await response.json();
        console.log("Ответ от API CryptoBot:", data);

        if (data.ok) {
            return res.status(200).json({ pay_url: data.result.pay_url });
        } else {
            // У КРИПТОБОТА ОШИБКА ЛЕЖИТ В data.error.name ИЛИ data.error.code
            const errName = data.error ? (data.error.name || data.error.code) : "UNKNOWN_ERROR";
            console.error("CryptoBot вернул ошибку API:", errName);
            return res.status(400).json({ error: `CryptoBot API: ${errName}` });
        }

    } catch (error) {
        return res.status(500).json({ error: "Внутренняя ошибка сервера: " + error.message });
    }
};
