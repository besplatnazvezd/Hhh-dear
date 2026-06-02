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

    let body = {};
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (e) {
        return res.status(400).json({ error: "Некорректный формат данных" });
    }

    const { amount, userId, username, items } = body;
    const cryptoPayToken = process.env.CRYPTO_BOT_TOKEN; 

    if (!cryptoPayToken) {
        return res.status(500).json({ error: "На сервере Vercel не настроен CRYPTO_BOT_TOKEN!" });
    }

    try {
        const cryptoAmount = parseFloat(amount).toFixed(2);

        // Упаковываем все данные заказа в сжатый JSON (лимит CryptoBot payload - 1024 символа)
        const orderPayload = JSON.stringify({
            u: username || "Не указан",
            id: userId || "Не указан",
            items: items.map(i => ({ n: i.name, q: i.qty, c: i.comment }))
        });

        const response = await fetch('https://pay.crypt.bot/api/createInvoice', {
            method: 'POST',
            headers: {
                'Crypto-Pay-API-Token': cryptoPayToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fiat: 'RUB',
                accepted_assets: 'USDT',
                amount: cryptoAmount.toString(),
                description: `Оплата в BOSS STORE для @${username}`,
                payload: orderPayload, // Передаем секретные данные заказа
                allow_comments: false,
                allow_anonymous: false
            })
        });

        const data = await response.json();

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
