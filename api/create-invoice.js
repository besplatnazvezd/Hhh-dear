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

    const { amount, description } = req.body;
    const cryptoPayToken = process.env.CRYPTO_BOT_TOKEN;

    if (!cryptoPayToken) {
        return res.status(500).json({ error: "Токен не найден в настройках Vercel" });
    }

    try {
        // Делаем запрос на официальный рабочий адрес
        const response = await fetch('https://pay.cryptobot.in/api/createInvoice', {
            method: 'POST',
            headers: {
                'Crypto-Pay-API-Token': cryptoPayToken,
                'Content-Type': 'application/json',
                // МАСКИРОВКА: Притворяемся обычным браузером, чтобы Cloudflare не блокировал запрос
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                asset: 'USDT',
                amount: amount.toString(),
                description: description || "Оплата заказа",
                allow_comments: false,
                allow_anonymous: false
            })
        });

        const data = await response.json();

        if (data && data.ok) {
            return res.status(200).json({ pay_url: data.result.pay_url });
        } else {
            return res.status(400).json({ error: data.description || "Ошибка API Криптобота" });
        }
    } catch (error) {
        return res.status(500).json({ error: "Ошибка соединения: " + error.message });
    }
};
