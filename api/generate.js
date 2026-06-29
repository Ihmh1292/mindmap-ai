const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pdfBase64, filename, systemPrompt, pageFrom, pageTo } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: 'No PDF data provided' });
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64
              }
            },
            {
  type: 'text',
  text: `Nama fail: "${filename}". Ekstrak kandungan dari halaman ${pageFrom} hingga halaman ${pageTo} sahaja. Jangan ekstrak melebihi julat halaman yang ditetapkan.`}
          ]
        }
      ]
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let parsed;
try {
  const clean = rawText.replace(/```json|```/g, '').trim();
  parsed = JSON.parse(clean);
} catch (e) {
  try {
    let partial = rawText.replace(/```json|```/g, '').trim();
    
    // Kira berapa { dan } yang ada
    let opens  = 0;
    let closes = 0;
    for (const ch of partial) {
      if (ch === '{') opens++;
      if (ch === '}') closes++;
    }
    
    // Buang trailing incomplete string/array dulu
    // Cari } terakhir yang valid
    let lastValid = partial.lastIndexOf('}');
    if (lastValid > 0) {
      partial = partial.substring(0, lastValid + 1);
    }
    
    // Recount selepas trim
    opens  = (partial.match(/\{/g) || []).length;
    closes = (partial.match(/\}/g) || []).length;
    
    // Close semua yang terbuka
    const diff = opens - closes;
    for (let i = 0; i < diff; i++) partial += '}';
    
    parsed = JSON.parse(partial);
    
  } catch (e2) {
    return res.status(422).json({
      error: 'Claude did not return valid JSON',
      raw: rawText.substring(0, 2000)
    });
  }
}

    return res.status(200).json({ success: true, data: parsed });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}