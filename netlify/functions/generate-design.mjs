function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function makeImage(apiKey, prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      size: '1024x1024',
      quality: 'low',
      output_format: 'jpeg'
    })
  });

  const raw = await res.text();

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`OpenAI returned invalid response: ${raw.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(data?.error?.message || 'OpenAI image generation failed.');
  }

  const b64 = data?.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error('OpenAI returned no image data.');
  }

  return b64;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return json(
      { error: 'OPENAI_API_KEY is not configured in Netlify.' },
      500
    );
  }

  try {
    const {
      prompt = '',
      project = '',
      revision = 1
    } = await req.json();

    if (!String(prompt).trim()) {
      return json(
        { error: 'A design prompt is required.' },
        400
      );
    }

    const imagePrompt = `
Create flat print artwork for a fitted 6-foot event table cover.

Project:
${project}

Customer direction:
${prompt}

This is textile artwork only.

Do not render:
- a table
- a room
- people
- fabric folds
- a mockup
- dimensions
- sewing marks
- crop marks

Create edge-to-edge artwork with a strong hero composition.

Important logos or wording should be readable and intentional.

This is a temporary MVP test image that will be mapped onto the 3D table-cover visualizer.
`;

    const imageBase64 = await makeImage(apiKey, imagePrompt);

    return json({
      ok: true,
      revision: Number(revision) || 1,

      // TEMPORARY MVP TEST:
      // same generated image drives all surfaces
      frontBase64: imageBase64,
      topBase64: imageBase64,
      wrapBase64: imageBase64,

      mimeType: 'image/jpeg',
      generator: 'gpt-image-2'
    });

  } catch (err) {
    return json(
      { error: err?.message || 'Unexpected generation error.' },
      500
    );
  }
};