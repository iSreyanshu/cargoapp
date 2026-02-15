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
import { Wallet, Mnemonic } from 'ethers';
import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import crypto from 'crypto';

const app = express();

app.get('/v2/generate/:chain?', async (req, res) => {
    try {
        const chain = (req.params.chain || 'eth').toLowerCase();
        const queryFilter = req.query.filterCount;
        const queryPhraseLength = parseInt(req.query.phraseLength);
        
        // 1. Validate Chain
        const supportedChains = ['eth', 'ethereum', 'sol', 'solana'];
        if (!supportedChains.includes(chain)) {
            return res.status(400).json({ success: false, error: "Unsupported chain. Use 'eth' or 'sol'." });
        }

        let count = 1;
        if (queryFilter) {
            count = parseInt(queryFilter);
            if (isNaN(count) || count <= 0 || count > 99) {
                return res.status(400).json({ success: false, error: "Count must be between 1 and 99." });
            }
        }

        // 2. Phrase Length to Bytes Mapping
        const lengthMap = { 12: 16, 15: 20, 18: 24, 21: 28, 24: 32 };
        let entropyBytes = lengthMap[queryPhraseLength] || 16; 

        if (queryPhraseLength && !lengthMap[queryPhraseLength]) {
            return res.status(400).json({ success: false, error: "Invalid phraseLength. Use (12, 15, 18, 21, 24)" });
        }

        const wallets = [];

        for (let i = 0; i < count; i++) {
            // Fix 1: Always generate FRESH entropy
            const entropy = crypto.randomBytes(entropyBytes);
            const mnemonicInstance = Mnemonic.fromEntropy(entropy);
            const phrase = mnemonicInstance.phrase;
            
            let walletData = {};

            if (chain === 'sol' || chain === 'solana') {
                // Fix 2: Get Seed as Buffer (DO NOT use .toString('hex'))
                const seed = mnemonicInstance.computeSeed(); 
                const seedBuffer = Buffer.from(seed.slice(2), 'hex'); // Convert 0x hex to Buffer
                
                const path = "m/44'/501'/0'/0'";
                // Fix 3: Direct seed buffer pass kijiye
                const derivedSeed = derivePath(path, seedBuffer).key;
                const keypair = Keypair.fromSeed(derivedSeed);

                walletData = {
                    address: keypair.publicKey.toBase58(),
                    privateKey: Buffer.from(keypair.secretKey).toString('hex'),
                    mnemonicPhrase: phrase,
                    entropy: entropy.toString('hex') // Readable format
                };
            } else {
                const wallet = Wallet.fromPhrase(phrase);
                walletData = {
                    address: wallet.address,
                    privateKey: wallet.privateKey,
                    mnemonicPhrase: phrase,
                    entropy: entropy.toString('hex')
                };
            }
            wallets.push(walletData);
        }

        res.status(200).json({
            success: true,
            chain: chain.includes('sol') ? 'solana' : 'ethereum',
            data: count === 1 ? wallets[0] : wallets
        });

    } catch (err) {
        res.status(500).json({ success: false, error: "Internal Server Error", message: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
