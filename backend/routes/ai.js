const express = require('express');
const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  for (const model of MODELS) {
    for (let retry = 0; retry < 3; retry++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );

        if (response.status === 503) {
          console.log(`503 from ${model}. Retrying ${retry + 1}/3...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }

        if (response.status === 429) {
          console.warn(`429 rate limit from ${model}`);
          break;
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Gemini API error from ${model} (${response.status}):`, errText);
          break;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return text;
        }
      } catch (err) {
        console.error(`Error requesting ${model}:`, err.message);
      }
    }
  }

  throw new Error('All Gemini models failed to return a response');
}

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, message: 'Valid prompt is required' });
  }

  try {
    const text = await callGemini(prompt);
    res.json({ success: true, text });
  } catch (err) {
    console.error('AI chat endpoint error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
