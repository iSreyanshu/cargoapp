import express from 'express';
import { Wallet, Mnemonic, randomBytes } from 'ethers';

const app = express();

app.get('/v2/generate', (req, res) => {
    try {
        const queryFilter = req.query.filterCount;
        const queryPhraseLength = parseInt(req.query.phraseLength);
        const queryBytes = parseInt(req.query.bytes);

        let count = 1;
        if (queryFilter) {
            count = parseInt(queryFilter);
            if (isNaN(count)) return res.status(400).json({ success: false, error: "Invalid 'filter' parameter." });
            if (count <= 0) return res.status(400).json({ success: false, error: "Count must be greater than 0." });
            if (count > 99) return res.status(400).json({ success: false, error: "Maximum limit is 99 wallets per request." });
        }

        let entropyBytes = 16;

        if (queryPhraseLength) {
            const lengthMap = { 12: 16, 15: 20, 18: 24, 21: 28, 24: 32 };
            if (!lengthMap[queryPhraseLength]) {
                return res.status(400).json({ success: false, error: "Invalid phraseLength. Use (12, 15, 18, 21, 24)" });
            }
            entropyBytes = lengthMap[queryPhraseLength];
        } else if (queryBytes) {
            const allowedBytes = [16, 20, 24, 28, 32];
            if (!allowedBytes.includes(queryBytes)) {
                return res.status(400).json({ success: false, error: "Invalid bytes. Use (16, 20, 24, 28, 32)" });
            }
            entropyBytes = queryBytes;
        }

        const wallets = [];

        for (let i = 0; i < count; i++) {
            const phrase = Mnemonic.entropyToPhrase(randomBytes(entropyBytes));
            const mnemonic = Mnemonic.fromPhrase(phrase);
            const wallet = Wallet.fromPhrase(mnemonic.phrase);
            wallets.push({
                address: wallet.address,
                privateKey: wallet.privateKey,
                mnemonicPhrase: mnemonic.phrase,
                entropy: mnemonic.entropy
            });
        }

        res.status(200).json({
            success: true,
            data: count === 1 ? wallets[0] : wallets
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: err.message
        });
    }
});

export default app;
