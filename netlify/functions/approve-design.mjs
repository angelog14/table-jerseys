export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const googleUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!googleUrl) return Response.json({ error: 'GOOGLE_SCRIPT_URL is not configured in Netlify.' }, { status: 500 });

  try {
    const body = await req.json();
    if (!body.approved) return Response.json({ error: 'Customer approval is required.' }, { status: 400 });
    if (!body.frontBase64 || !body.topBase64 || !body.wrapBase64) return Response.json({ error: 'Complete artwork state is required.' }, { status: 400 });

    // Production geometry is intentionally NOT trusted from the browser. Google owns it.
    const payload = {
      source:'table-jerseys-v8',
      approved:true,
      revision:Number(body.revision)||1,
      project:String(body.project || 'Untitled Project').slice(0,200),
      email:String(body.email || '').slice(0,250),
      prompt:String(body.prompt || '').slice(0,8000),
      mimeType:body.mimeType || 'image/jpeg',
      frontBase64:body.frontBase64,
      topBase64:body.topBase64,
      wrapBase64:body.wrapBase64
    };

    const form = new URLSearchParams();
    form.set('payload', JSON.stringify(payload));
    const googleRes = await fetch(googleUrl, { method:'POST', body:form });
    const text = await googleRes.text();
    let data;
    try { data=JSON.parse(text); } catch { throw new Error(`Google backend returned an invalid response: ${text.slice(0,180)}`); }
    if (!googleRes.ok || data.ok===false) throw new Error(data.error || 'Google production handoff failed.');
    return Response.json({ ok:true, jobId:data.jobId, revision:payload.revision });
  } catch (err) {
    return Response.json({ error:err?.message || 'Unexpected approval error.' }, { status:500 });
  }
};
