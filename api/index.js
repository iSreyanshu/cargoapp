import express from 'express';
import { Secp256k1, Address } from 'ox';

const app = express();

app.get('/v2/generate', (req, res) => {
    try {
        const count = parseInt(req.query.filter) || 1;        
        const limit = Math.min(count, 50);
        const wallets = [];

        for (let i = 0; i < limit; i++) {
            const privateKey = Secp256k1.randomPrivateKey();
            const publicKey = Secp256k1.getPublicKey({ privateKey });
            const address = Address.fromPublicKey(publicKey);

            wallets.push({
                address: address,
                privateKey: privateKey
            });
        }

        const response = limit === 1 ? wallets[0] : { count: limit, wallets };
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate wallets' });
    }
});

export default app;
