export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { prompt, imageBase64, mimeType, isPDF, pdfImages } = req.body;

    const hasPageImages = pdfImages && pdfImages.length > 0;
    const hasSingleImage = imageBase64 && !isPDF;
    const model = (hasPageImages || hasSingleImage)
      ? 'meta-llama/llama-4-scout-17b-16e-instruct'
      : 'llama-3.3-70b-versatile';

    let messages;

    if (hasPageImages) {
      // Scanned PDF — send each page as a vision image
      const content = pdfImages.map(img => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${img}` }
      }));
      content.push({ type: 'text', text: prompt });
      messages = [{ role: 'user', content }];
    } else if (hasSingleImage) {
      messages = [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } },
          { type: 'text', text: prompt }
        ]
      }];
    } else {
      // Text extracted from PDF or plain text file
      messages = [{ role: 'user', content: prompt }];
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Groq API error' });
    }

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
