import express from 'express';
import { Wallet, Mnemonic } from 'ethers';

const app = express();

app.get('/v2/generate', (req, res) => {
    try {
        const queryFilter = req.query.filter;
        let count = 1;
        if (queryFilter) {
            count = parseInt(queryFilter);
            
            if (isNaN(count)) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid 'filter' parameter."
                });
            }

            if (count <= 0) {
                return res.status(400).json({
                    success: false,
                    error: "Count must be greater than 0."
                });
            }

            if (count > 99) {
                return res.status(400).json({
                    success: false,
                    error: "Maximum limit is 99 wallets per request."
                });
            }
        }

        const wallets = [];

        for (let i = 0; i < count; i++) {
            const entropy = Mnemonic.entropyToPhrase(ethers.randomBytes(16));
            const mnemonic = Mnemonic.fromPhrase(entropy);
            // Standard BIP-44 path: m/44'/60'/0'/0/0
            const wallet = Wallet.fromPhrase(mnemonic.phrase);
            wallets.push({
                address: wallet.address,
                privateKey: wallet.privateKey,
                mnemonicPhrases: mnemonic
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
