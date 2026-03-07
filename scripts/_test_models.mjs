import fs from 'fs';

// load env
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(l => {
    const t = l.trim();
    if (t && !t.startsWith('#')) {
        const eq = t.indexOf('=');
        if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).replace(/['"]/g, '').trim();
    }
});

const key = process.env.GEMINI_API_KEY;

async function testList() {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const json = await res.json();
        if (json.error) {
            console.error('List Error:', json.error);
        } else {
            console.log('Available models:');
            const flashes = json.models.filter(m => m.name.includes('flash'));
            flashes.forEach(m => console.log(m.name, m.supportedGenerationMethods));
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

testList();
