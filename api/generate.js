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
      max_tokens: 16000,
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
              text: `Nama fail: "${filename}". Ekstrak kandungan dari halaman ${pageFrom} hingga halaman ${pageTo} sahaja. Jangan ekstrak melebihi julat halaman yang ditetapkan.`
            }
          ]
        }
      ]
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    console.log('rawText length:', rawText.length);
    console.log('rawText last 200:', rawText.slice(-200));

    let parsed;
try {
  // Strip markdown backticks if any
  const clean = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  parsed = JSON.parse(clean);
} catch (e) {
  // Cuba extract JSON object dari teks
  const match = rawText.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      parsed = JSON.parse(match[0]);
    } catch (e2) {
      return res.status(422).json({
        error: 'Claude did not return valid JSON',
        raw: rawText.substring(0, 500),
        parseError: e2.message
      });
    }
  } else {
    return res.status(422).json({
      error: 'No JSON found in response',
      raw: rawText.substring(0, 500)
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
};
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};