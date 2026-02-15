/**
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


**/


import express from 'express';
import { Wallet, Mnemonic, randomBytes, HDNodeWallet } from 'ethers';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const app = express();

// Derivation Paths Config
const COIN_CONFIG = {
    eth:   { path: "m/44'/60'/0'/0/0",  name: "Ethereum" },
    tron:  { path: "m/44'/195'/0'/0/0", name: "Tron" },
    btc:   { path: "m/44'/0'/0'/0/0",   name: "Bitcoin" },
    sui:   { path: "m/44'/784'/0'/0'/0'", name: "Sui" },
    aptos: { path: "m/44'/637'/0'/0'/0'", name: "Aptos" },
    sol:   { path: "m/44'/501'/0'/0'",   name: "Solana" }
};

app.get('/v2/generate/:coin?', (req, res) => {
    try {
        // --- Same Original Variables ---
        const coinParam = req.params.coin || 'eth';
        const selectedCoin = coinParam.toLowerCase();
        
        if (!COIN_CONFIG[selectedCoin]) {
            return res.status(400).json({ success: false, error: "Chain not supported. Use (eth, sol, btc, tron, sui, aptos)" });
        }

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
            
            let address = "";
            let privateKey = "";
            const config = COIN_CONFIG[selectedCoin];

            if (selectedCoin === 'sol') {
                // Solana logic (Ed25519)
                const seed = mnemonic.computeSeed();
                const solanaKeypair = Keypair.fromSeed(new Uint8Array(seed.slice(0, 32)));
                address = solanaKeypair.publicKey.toBase58();
                privateKey = bs58.encode(solanaKeypair.secretKey);
            } else {
                // Standard HD Derivation for others
                const hdNode = HDNodeWallet.fromMnemonic(mnemonic, config.path);
                address = hdNode.address;
                privateKey = hdNode.privateKey;
            }

            wallets.push({
                coin: config.name,
                address: address,
                privateKey: privateKey,
                mnemonicPhrase: mnemonic.phrase,
                entropy: mnemonic.entropy,
                derivationPath: config.path
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
