import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './styles.css';

const DEFAULT_PROMPT = 'Make a Smoking Aces BBQ fitted table jersey that looks like a brick smoker. Use weathered red brick on the front, back, and sides. Make the top look like glowing charcoal under a black grill grate. Put a large distressed wood Smoking Aces BBQ sign on the front only.';

const TABLE = Object.freeze({ length: 72, width: 30, height: 29 });
const PANEL_MAP = Object.freeze({
  top: { width: 72, height: 30, asset: 'topBase64' },
  front: { width: 72, height: 29, asset: 'frontBase64' },
  back: { width: 72, height: 29, asset: 'wrapBase64' },
  left: { width: 30, height: 29, asset: 'wrapBase64' },
  right: { width: 30, height: 29, asset: 'wrapBase64' }
});

function makeFallbackCanvas(kind, width = 1536, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (kind === 'top') {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, width, height);
    for (let i=0; i<110; i++) {
      const x=Math.random()*width, y=Math.random()*height, r=16+Math.random()*42;
      const g=ctx.createRadialGradient(x,y,1,x,y,r);
      g.addColorStop(0,'#ffb147'); g.addColorStop(.25,'#e95317'); g.addColorStop(.58,'#621b0c'); g.addColorStop(1,'rgba(10,10,10,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle='#292929'; ctx.lineWidth=20;
    for (let x=18; x<width; x+=66) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); }
    ctx.strokeStyle='rgba(255,255,255,.16)'; ctx.lineWidth=3;
    for (let x=27; x<width; x+=66) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); }
  } else {
    ctx.fillStyle='#4a251e'; ctx.fillRect(0,0,width,height);
    const bw=190,bh=100,m=9;
    for (let row=0,y=0; y<height+bh; row++,y+=bh) {
      const off=(row%2)*bw/2;
      for (let x=-bw; x<width+bw; x+=bw) {
        const xx=x+off;
        const g=ctx.createLinearGradient(xx,y,xx+bw,y+bh);
        g.addColorStop(0,'#5a2d24'); g.addColorStop(.5,'#8b4431'); g.addColorStop(1,'#4b251f');
        ctx.fillStyle=g; ctx.fillRect(xx+m/2,y+m/2,bw-m,bh-m);
        ctx.strokeStyle='rgba(20,10,8,.55)'; ctx.lineWidth=2; ctx.strokeRect(xx+m/2,y+m/2,bw-m,bh-m);
      }
    }
    if (kind === 'front') {
      const x=width*.18,y=height*.22,w=width*.64,h=height*.56;
      ctx.save(); ctx.shadowColor='rgba(0,0,0,.55)'; ctx.shadowBlur=24; ctx.shadowOffsetY=10;
      const wood=ctx.createLinearGradient(x,y,x,y+h); wood.addColorStop(0,'#60402b'); wood.addColorStop(.52,'#342017'); wood.addColorStop(1,'#563420');
      ctx.fillStyle=wood; ctx.fillRect(x,y,w,h); ctx.shadowColor='transparent'; ctx.strokeStyle='#b69468'; ctx.lineWidth=12; ctx.strokeRect(x,y,w,h);
      ctx.fillStyle='#ead8b8'; ctx.textAlign='center'; ctx.font='900 105px Georgia'; ctx.fillText('SMOKING ACES',width/2,y+170);
      ctx.font='700 52px Georgia'; ctx.fillText('WORLD FAMOUS',width/2,y+245);
      ctx.font='900 150px Georgia'; ctx.fillText('BBQ',width/2,y+410); ctx.restore();
    }
  }
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

function setCoverCrop(tex, targetAspect) {
  const image=tex.image;
  const imageAspect=(image?.width && image?.height) ? image.width/image.height : 1;
  tex.wrapS=THREE.ClampToEdgeWrapping; tex.wrapT=THREE.ClampToEdgeWrapping;
  tex.repeat.set(1,1); tex.offset.set(0,0);
  if (imageAspect > targetAspect) {
    const visibleX=targetAspect/imageAspect;
    tex.repeat.x=visibleX; tex.offset.x=(1-visibleX)/2;
  } else if (imageAspect < targetAspect) {
    const visibleY=imageAspect/targetAspect;
    tex.repeat.y=visibleY; tex.offset.y=(1-visibleY)/2;
  }
  tex.needsUpdate=true;
  return tex;
}

function loadTextureFromDataUrl(url, renderer, apply) {
  if (!url) return () => {};
  let disposed=false;
  const loader=new THREE.TextureLoader();
  loader.load(url, tex => {
    if (disposed) { tex.dispose(); return; }
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    apply(tex);
  });
  return () => { disposed=true; };
}

function TableViewer({ assets, onController }) {
  const mountRef = useRef(null);
  const controllerCb = useCallback(api => onController?.(api), [onController]);

  useEffect(() => {
    const mount=mountRef.current; if (!mount) return;
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(36,1,0.1,100);
    camera.position.set(7.6,5.4,8.6);

    const renderer=new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label','Interactive 3D fitted table cover');
    mount.appendChild(renderer.domElement);

    const materials = Array.from({length:6},()=>new THREE.MeshStandardMaterial({roughness:.86,metalness:0}));
    // x length = 7.2, y height = 2.9, z depth = 3.0. One mesh = one finished cover.
    const geometry=new THREE.BoxGeometry(7.2,2.9,3.0,1,1,1);
    const cover=new THREE.Mesh(geometry, materials);
    cover.position.y=1.5; cover.castShadow=true; cover.receiveShadow=true; scene.add(cover);

    // Three.js BoxGeometry groups: right, left, top, bottom, front, back.
    const frontFallback=makeFallbackCanvas('front');
    const topFallback=makeFallbackCanvas('top');
    const wrapFallback=makeFallbackCanvas('wrap');
    const ownedTextures=[];
    const assign=(idx,tex,targetAspect)=>{
      const mapped=setCoverCrop(tex.clone(),targetAspect);
      mapped.colorSpace=THREE.SRGBColorSpace; mapped.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      materials[idx].map=mapped; materials[idx].color.set(0xffffff); materials[idx].needsUpdate=true; ownedTextures.push(mapped);
    };
    assign(0,wrapFallback,30/29); assign(1,wrapFallback,30/29); assign(2,topFallback,72/30); materials[3].color.set(0x181818); assign(4,frontFallback,72/29); assign(5,wrapFallback,72/29);

    const cleanups=[];
    if (assets) {
      const mime=assets.mimeType || 'image/jpeg';
      const frontUrl=`data:${mime};base64,${assets.frontBase64}`;
      const topUrl=`data:${mime};base64,${assets.topBase64}`;
      const wrapUrl=`data:${mime};base64,${assets.wrapBase64}`;
      cleanups.push(loadTextureFromDataUrl(frontUrl,renderer,t=>{assign(4,t,72/29);t.dispose();}));
      cleanups.push(loadTextureFromDataUrl(topUrl,renderer,t=>{assign(2,t,72/30);t.dispose();}));
      cleanups.push(loadTextureFromDataUrl(wrapUrl,renderer,t=>{assign(0,t,30/29);assign(1,t,30/29);assign(5,t,72/29);t.dispose();}));
    }

    const floor=new THREE.Mesh(new THREE.PlaneGeometry(34,34),new THREE.ShadowMaterial({color:0x000000,opacity:.35}));
    floor.rotation.x=-Math.PI/2; floor.position.y=.03; floor.receiveShadow=true; scene.add(floor);
    scene.add(new THREE.HemisphereLight(0xffffff,0x241a16,1.7));
    const key=new THREE.DirectionalLight(0xffffff,3.6); key.position.set(5.5,9,7); key.castShadow=true; key.shadow.mapSize.set(1536,1536); scene.add(key);
    const rim=new THREE.DirectionalLight(0xffd7b0,1.25); rim.position.set(-6,5,-6); scene.add(rim);

    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(0,1.35,0);
    controls.enableDamping=true; controls.dampingFactor=.075;
    controls.enablePan=false; controls.enableZoom=true; controls.zoomSpeed=.75; controls.rotateSpeed=.72;
    controls.minDistance=6.4; controls.maxDistance=14;
    controls.minPolarAngle=.08; controls.maxPolarAngle=Math.PI*.49;
    controls.update();

    const views={
      front:[0,3.1,10.2],
      three:[7.6,5.4,8.6],
      right:[10.2,3.1,0],
      back:[0,3.1,-10.2],
      left:[-10.2,3.1,0],
      top:[0,12.4,.01]
    };
    const api={
      setView(name){const p=views[name]; if(!p)return; camera.position.set(...p); controls.target.set(0,1.35,0); controls.update();},
      reset(){camera.position.set(...views.three);controls.target.set(0,1.35,0);controls.update();}
    };
    controllerCb(api);

    function resize(){const w=Math.max(300,mount.clientWidth||300),h=Math.max(320,mount.clientHeight||400); renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
    resize(); const ro=new ResizeObserver(resize); ro.observe(mount);
    let raf=0; const animate=()=>{controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(animate)}; animate();

    return()=>{
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); cleanups.forEach(fn=>fn());
      geometry.dispose(); ownedTextures.forEach(t=>t.dispose()); materials.forEach(m=>m.dispose());
      frontFallback.dispose(); topFallback.dispose(); wrapFallback.dispose(); floor.geometry.dispose(); floor.material.dispose(); renderer.dispose();
      mount.innerHTML=''; controllerCb(null);
    };
  }, [assets, controllerCb]);

  return <div className="viewer-shell"><div className="viewer" ref={mountRef}><div className="viewer-hint">Drag to orbit · pinch/scroll to zoom</div></div></div>;
}

function App(){
  const [project,setProject]=useState('');
  const [email,setEmail]=useState('');
  const [prompt,setPrompt]=useState(DEFAULT_PROMPT);
  const [assets,setAssets]=useState(null);
  const [revision,setRevision]=useState(0);
  const [approved,setApproved]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('Describe the table jersey, then create the design.');
  const [error,setError]=useState('');
  const [job,setJob]=useState(null);
  const [viewerApi,setViewerApi]=useState(null);

  const invalidateApproval=()=>{setApproved(false);setJob(null);};

  async function generate(){
    if(!prompt.trim())return;
    setBusy(true);setError('');invalidateApproval();setStatus('Creating production artwork for the 2D panel state…');
    try{
      const res=await fetch('/.netlify/functions/generate-design',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:prompt.trim(),project:project.trim(),revision:revision+1})});
      const data=await res.json(); if(!res.ok)throw new Error(data.error||'Image generation failed.');
      setAssets(data); setRevision(r=>r+1); setStatus('Artwork created. Orbit the finished cover, revise if needed, then approve.');
    }catch(e){setError(e.message);setStatus('Generation failed.');}
    finally{setBusy(false);}
  }

  async function doIt(){
    if(!approved||!assets)return;
    setBusy(true);setError('');setStatus('Locking the approved 2D design state and creating private production files…');
    try{
      const res=await fetch('/.netlify/functions/approve-design',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        project:project.trim()||'Untitled Project',email:email.trim(),prompt:prompt.trim(),approved:true,revision,
        mimeType:assets.mimeType,frontBase64:assets.frontBase64,topBase64:assets.topBase64,wrapBase64:assets.wrapBase64,
        panelMap:PANEL_MAP,table:TABLE
      })});
      const data=await res.json(); if(!res.ok)throw new Error(data.error||'Approval failed.');
      setJob(data);setStatus('Approved revision locked and sent to Table Jerseys production.');
    }catch(e){setError(e.message);setStatus('Approval failed.');}
    finally{setBusy(false);}
  }

  return <main className="app">
    <div className="brand"><div><h1>TABLE JERSEYS</h1><div className="brand-sub">Describe it. See it. Do it.</div></div><span className="pill">6 ft fitted cover</span></div>
    <div className="grid two">
      <section className="card">
        <div className="proof-copy"><strong>Finished product proof</strong><span className="tiny">live 3D visualization</span></div>
        <TableViewer assets={assets} onController={setViewerApi}/>
        <div className="viewbar">
          <button className="viewbtn" onClick={()=>viewerApi?.setView('front')}>Front</button>
          <button className="viewbtn" onClick={()=>viewerApi?.setView('three')}>3/4</button>
          <button className="viewbtn" onClick={()=>viewerApi?.setView('left')}>Left</button>
          <button className="viewbtn" onClick={()=>viewerApi?.setView('right')}>Right</button>
          <button className="viewbtn" onClick={()=>viewerApi?.setView('back')}>Back</button>
          <button className="viewbtn" onClick={()=>viewerApi?.setView('top')}>Top</button>
        </div>
      </section>
      <section className="card">
        <label className="label">Customer / project</label>
        <input className="input" value={project} onChange={e=>{setProject(e.target.value);invalidateApproval();}} placeholder="Smoking Aces BBQ"/>
        <div style={{height:10}}/>
        <label className="label">Email (optional)</label>
        <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="customer@example.com"/>
        <div style={{height:10}}/>
        <label className="label">What should we make?</label>
        <textarea className="textarea" value={prompt} onChange={e=>{setPrompt(e.target.value);invalidateApproval();}}/>
        <div className="row" style={{marginTop:10}}><button className="btn primary" disabled={busy} onClick={generate}>{busy?<><span className="loader"/>WORKING…</>:assets?'REVISE DESIGN':'CREATE DESIGN'}</button></div>
        
        <div className="workflow"><div>Prompt</div><div>2D art</div><div>3D proof</div><div>Approve</div><div>DO IT</div></div>
      </section>
    </div>

    {assets&&<section className="card">
      <div className="approval"><input id="approve" type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/><label htmlFor="approve"><strong>I approve this visual proof — revision {revision}</strong><br/><span className="tiny">DO IT freezes this exact 2D panel state. The 3D model displays that same state in real time.</span></label></div>
      <div className="row" style={{marginTop:14}}><button className="btn doit" disabled={!approved||busy} onClick={doIt}>DO IT</button></div>
    </section>}

    <section className="card">
      <div className="status"><strong>Status:</strong> {status}</div>
      {error&&<div className="error" style={{marginTop:10}}>{error}</div>}
      {job&&<div className="success" style={{marginTop:10}}><strong>Job {job.jobId}</strong><br/>Revision {revision} is locked. Your private Google Sheet now contains the Drive links for the production layout and source artwork.</div>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
