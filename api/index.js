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
        
        const supportedChains = ['eth', 'ethereum', 'sol', 'solana'];
        if (!supportedChains.includes(chain)) {
            return res.status(400).json({ success: false, error: "Unsupported chain. Use 'ethereum' or 'solana' " });
        }

        let count = 1;
        if (queryFilter) {
            count = parseInt(queryFilter);
            if (isNaN(count)) return res.status(400).json({ success: false, error: "Invalid 'filterCount' parameter." });
            if (count <= 0) return res.status(400).json({ success: false, error: "Count must be greater than 0." });
            if (count > 99) return res.status(400).json({ success: false, error: "Maximum limit is 99 wallets per request." });
        }

        const lengthMap = { 12: 16, 15: 20, 18: 24, 21: 28, 24: 32 };
        let entropyBytes = lengthMap[queryPhraseLength] || 16; 

        if (queryPhraseLength && !lengthMap[queryPhraseLength]) {
            return res.status(400).json({ success: false, error: "Invalid phraseLength. Use (12, 15, 18, 21, 24)" });
        }

        const wallets = [];

        for (let i = 0; i < count; i++) {
            const entropy = crypto.randomBytes(entropyBytes);
            const mnemonicInstance = Mnemonic.fromEntropy(entropy);
            const phrase = mnemonicInstance.phrase;
            
            let walletData = {};

            if (chain === 'sol' || chain === 'solana') {
                const seed = mnemonicInstance.computeSeed(); 
                const seedBuffer = Buffer.from(seed.slice(2), 'hex');
                
                const path = "m/44'/501'/0'/0'";
                const derivedSeed = derivePath(path, seedBuffer).key;
                const keypair = Keypair.fromSeed(derivedSeed);

                walletData = {
                    address: keypair.publicKey.toBase58(),
                    privateKey: Buffer.from(keypair.secretKey).toString('hex'),
                    mnemonicPhrase: phrase,
                    entropy: entropy.toString('hex')
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
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

export default app;
