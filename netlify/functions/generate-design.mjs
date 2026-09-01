async function makeImage(apiKey, prompt, size='1536x1024', quality='medium') {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      size,
      quality,
      output_format: 'jpeg',
      output_compression: 82
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'OpenAI image generation failed.');
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data.');
  return b64;
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY is not configured in Netlify.' }, { status: 500 });

  try {
    const { prompt='', project='', revision=1 } = await req.json();
    const customer = String(prompt).trim();
    const name = String(project || '').trim();
    if (!customer) return Response.json({ error: 'A design prompt is required.' }, { status: 400 });

    const common = [
      'You are creating flat print artwork for a fitted 6-foot event table cover used for dye sublimation.',
      'The private 2D sew pattern is the manufacturing source of truth. Your task is artwork only.',
      'Do NOT render a table, room, fabric folds, perspective, people, floor, shadows outside the artwork, mockups, panel labels, dimensions, crop marks, or sewing marks.',
      'Create edge-to-edge premium textile artwork. The customer will view it mapped live to a 3D fitted-cover model.',
      'Photorealistic textures are allowed when requested.',
      'Any important logo or wording must be clear and intentional. Do not invent extra brand copy.',
      name ? `Project: ${name}.` : '',
      `Customer direction: ${customer}`
    ].filter(Boolean).join('\n');

    const frontPrompt = `${common}\nFRONT PANEL ARTWORK. Physical panel: 72 x 29 inches, wide landscape. This is the hero face. Honor all requested front-only branding and imagery. Keep the composition readable from several feet away. Fill the whole image to the edges.`;
    const topPrompt = `${common}\nTOP PANEL ARTWORK. Physical panel: 72 x 30 inches, wide landscape viewed from overhead. Make the top visually coherent with the front. Do not repeat front-only branding unless requested. Fill the whole image to the edges.`;
    const wrapPrompt = `${common}\nWRAP SURFACE ARTWORK used on LEFT, RIGHT, and BACK in this MVP. Make a cohesive secondary/background treatment that can repeat cleanly around these vertical surfaces. Avoid required text unless the customer explicitly asks for it on all wrap surfaces. Fill the whole image to the edges.`;

    const quality = process.env.OPENAI_IMAGE_QUALITY || 'medium';
    const [frontBase64, topBase64, wrapBase64] = await Promise.all([
      makeImage(apiKey, frontPrompt, '1536x1024', quality),
      makeImage(apiKey, topPrompt, '1536x1024', quality),
      makeImage(apiKey, wrapPrompt, '1536x1024', quality)
    ]);

    return Response.json({
      ok:true,
      revision:Number(revision)||1,
      frontBase64,
      topBase64,
      wrapBase64,
      mimeType:'image/jpeg',
      generator:'gpt-image-2'
    });
  } catch (err) {
    return Response.json({ error: err?.message || 'Unexpected generation error.' }, { status: 500 });
  }
};
