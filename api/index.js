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

// Official Libraries
import { Keypair as SolanaKeypair } from '@solana/web3.js';
import { Ed25519Keypair as SuiKeypair } from '@mysten/sui.js/keypairs/ed25519';
import { AptosAccount } from 'aptos';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import bs58 from 'bs58';

const ECPair = ECPairFactory(ecc);
const app = express();

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
        const coinParam = req.params.coin || 'eth';
        const selectedCoin = coinParam.toLowerCase();
        
        if (!COIN_CONFIG[selectedCoin]) {
            return res.status(400).json({ success: false, error: "Coin not supported. Use eth, sol, btc, tron, sui, aptos" });
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
            const seed = mnemonic.computeSeed();
            
            let address = "";
            let privateKey = "";
            const config = COIN_CONFIG[selectedCoin];

            // --- Multi-Chain Official Logic ---
            if (selectedCoin === 'sol') {
                const solanaKeypair = SolanaKeypair.fromSeed(new Uint8Array(seed.slice(0, 32)));
                address = solanaKeypair.publicKey.toBase58();
                privateKey = bs58.encode(solanaKeypair.secretKey);

            } else if (selectedCoin === 'btc') {
                const root = bitcoin.bip32.fromSeed(Buffer.from(seed.slice(2)), bitcoin.networks.bitcoin);
                const child = root.derivePath(config.path);
                const { address: btcAddress } = bitcoin.payments.p2pkh({ pubkey: child.publicKey });
                address = btcAddress;
                privateKey = child.toWIF(); // Bitcoin standard private key (WIF)

            } else if (selectedCoin === 'sui') {
                const suiKp = SuiKeypair.fromSecretKey(new Uint8Array(seed.slice(0, 32)));
                address = suiKp.getPublicKey().toSuiAddress();
                privateKey = suiKp.export().privateKey;

            } else if (selectedCoin === 'aptos') {
                const aptosAccount = new AptosAccount(new Uint8Array(seed.slice(0, 32)));
                address = aptosAccount.address().hex();
                privateKey = aptosAccount.toPrivateKeyObject().addressHex;

            } else if (selectedCoin === 'tron') {
                // Tron is EVM compatible but uses Base58 starting with 'T'
                const hdNode = HDNodeWallet.fromMnemonic(mnemonic, config.path);
                const ethAddr = hdNode.address.slice(2);
                const buffer = Buffer.from("41" + ethAddr, 'hex');
                const hash1 = ecc.sha256(buffer);
                const hash2 = ecc.sha256(hash1);
                const checksum = hash2.slice(0, 4);
                address = bs58.encode(Buffer.concat([buffer, checksum]));
                privateKey = hdNode.privateKey;

            } else {
                // Default ETH
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
