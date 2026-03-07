import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

function loadEnvLocal() {
    const path = join(PROJECT_ROOT, '.env.local');
    try {
        const content = readFileSync(path, 'utf8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eq = trimmed.indexOf('=');
                if (eq > 0) {
                    const key = trimmed.slice(0, eq).trim();
                    let value = trimmed.slice(eq + 1).trim();
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
                        value = value.slice(1, -1);
                    process.env[key] = value.replace(/\r$/, '').trim();
                }
            }
        }
    } catch (e) { }
}

loadEnvLocal();

async function testKey(keyName, modelName) {
    try {
        const key = process.env[keyName];
        if (!key) return;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
        });
        const status = res.status;
        const data = await res.text();
        if (status === 200) {
            console.log(`[${keyName}] SUCCESS (${modelName})`);
        } else {
            console.log(`[${keyName}] FAILED (${modelName}) - HTTP ${status}:`, JSON.parse(data).error.message);
        }
    } catch (e) {
        console.log(`[${keyName}] ERROR (${modelName}):`, e.message);
    }
}

async function run() {
    const models = [
        'gemini-3-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash'
    ];

    const key = 'GEMINI_API_KEY';
    console.log(`Testing with primary key: ${process.env[key]?.slice(0, 5)}...`);

    for (const m of models) {
        await testKey(key, m);
    }
}

run();
