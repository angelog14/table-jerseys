function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const googleUrl = process.env.GOOGLE_SCRIPT_URL;

  if (!googleUrl) {
    return json(
      { error: 'GOOGLE_SCRIPT_URL is not configured in Netlify.' },
      500
    );
  }

  try {
    const body = await req.json();

    if (!body.approved) {
      return json(
        { error: 'Customer approval is required.' },
        400
      );
    }

    if (!body.frontBase64 || !body.topBase64 || !body.wrapBase64) {
      return json(
        { error: 'Complete artwork state is required.' },
        400
      );
    }

    const payload = {
      source: 'table-jerseys-v8',
      approved: true,
      revision: Number(body.revision) || 1,
      project: String(body.project || 'Untitled Project').slice(0, 200),
      email: String(body.email || '').slice(0, 250),
      prompt: String(body.prompt || '').slice(0, 8000),
      mimeType: body.mimeType || 'image/jpeg',
      frontBase64: body.frontBase64,
      topBase64: body.topBase64,
      wrapBase64: body.wrapBase64
    };

    const form = new URLSearchParams();
    form.set('payload', JSON.stringify(payload));

    const googleRes = await fetch(googleUrl, {
      method: 'POST',
      body: form
    });

    const text = await googleRes.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Google backend returned an invalid response: ${text.slice(0, 180)}`
      );
    }

    if (!googleRes.ok || data.ok === false) {
      throw new Error(
        data.error || 'Google production handoff failed.'
      );
    }

    return json({
      ok: true,
      jobId: data.jobId,
      revision: payload.revision
    });

  } catch (err) {
    return json(
      { error: err?.message || 'Unexpected approval error.' },
      500
    );
  }
};