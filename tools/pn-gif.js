// A small GIF encoder for the patch notes tool (turns video frames into a GIF in the browser; no libraries).
// pnGif(frames, w, h, delayCs, progress) -> Uint8Array. frames = list of RGBA pixel arrays (w*h*4), all the same size.
// One 255-colour palette for the whole clip; a pixel that did not change keeps the previous frame (transparent), so still screens stay small.
function pnGif(frames, w, h, delayCs, progress){
  const n = frames.length, TRANS = 255, TH = 18;   // TH: a pixel this close (sum of |r|+|g|+|b|) to what is already shown is left alone
  // ---- palette: median cut over 5-bit colour bins of a sample of the frames ----
  const hist = new Uint32Array(32768), step = Math.max(1, Math.ceil(n / 16)), pxStep = Math.max(1, Math.floor(w * h / 40000));
  for (let f = 0; f < n; f += step){ const d = frames[f]; for (let p = 0; p < w * h; p += pxStep){ const o = p * 4; hist[(d[o] >> 3) << 10 | (d[o + 1] >> 3) << 5 | d[o + 2] >> 3]++; } }
  let boxes = [ { bins:[] } ]; for (let b = 0; b < 32768; b++) if (hist[b]) boxes[0].bins.push(b);
  const ch = (b, c) => c === 0 ? b >> 10 : c === 1 ? b >> 5 & 31 : b & 31;
  const info = bx => { let lo = [31, 31, 31], hi = [0, 0, 0], cnt = 0; bx.bins.forEach(b => { cnt += hist[b]; for (let c = 0; c < 3; c++){ const v = ch(b, c); if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; } }); bx.cnt = cnt; bx.rng = [0, 1, 2].map(c => hi[c] - lo[c]); bx.max = Math.max(...bx.rng); };
  info(boxes[0]);
  while (boxes.length < 255){
    let bi = -1, best = 0; boxes.forEach((bx, i) => { const sc = bx.max * Math.log2(1 + bx.cnt); if (bx.bins.length > 1 && bx.max > 0 && sc > best){ best = sc; bi = i; } });
    if (bi < 0) break;
    const bx = boxes[bi], c = bx.rng.indexOf(bx.max); bx.bins.sort((a, b) => ch(a, c) - ch(b, c));
    let half = bx.cnt / 2, acc = 0, cut = 1; for (let i = 0; i < bx.bins.length - 1; i++){ acc += hist[bx.bins[i]]; if (acc >= half){ cut = i + 1; break; } cut = i + 1; }
    const a = { bins:bx.bins.slice(0, cut) }, b = { bins:bx.bins.slice(cut) }; info(a); info(b); boxes.splice(bi, 1, a, b);
  }
  const pal = new Uint8Array(256 * 3);
  boxes.forEach((bx, i) => { let r = 0, g = 0, bl = 0, t = 0; bx.bins.forEach(b => { const k = hist[b]; r += (ch(b, 0) * 8 + 4) * k; g += (ch(b, 1) * 8 + 4) * k; bl += (ch(b, 2) * 8 + 4) * k; t += k; }); pal[i * 3] = Math.round(r / t); pal[i * 3 + 1] = Math.round(g / t); pal[i * 3 + 2] = Math.round(bl / t); });
  const np = boxes.length, lut = new Uint8Array(32768);
  for (let b = 0; b < 32768; b++){ const r = (b >> 10) * 8 + 4, g = (b >> 5 & 31) * 8 + 4, bl = (b & 31) * 8 + 4; let bd = 1e9, bk = 0; for (let k = 0; k < np; k++){ const dr = r - pal[k * 3], dg = g - pal[k * 3 + 1], db = bl - pal[k * 3 + 2], d = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (d < bd){ bd = d; bk = k; } } lut[b] = bk; }
  // ---- LZW ----
  function lzw(px){
    const out = [], MIN = 8, CLEAR = 256, EOI = 257; let size = 9, next = 258, cur = 0, bits = 0, dict = new Map();
    const put = c => { cur |= c << bits; bits += size; while (bits >= 8){ out.push(cur & 255); cur >>>= 8; bits -= 8; } };
    put(CLEAR); let pre = px[0];
    for (let i = 1; i < px.length; i++){
      const k = px[i], key = pre << 8 | k, v = dict.get(key);
      if (v !== undefined){ pre = v; continue; }
      put(pre);
      if (next === 4096){ put(CLEAR); next = 258; size = 9; dict = new Map(); }
      else { if (next >= (1 << size)) size++; dict.set(key, next++); }
      pre = k;
    }
    put(pre);
    if (next >= (1 << size) && size < 12) size++;   // the decoder has added one more entry by now
    put(EOI); if (bits > 0) out.push(cur & 255);
    return out;
  }
  // ---- file ----
  const o = []; const u16 = v => o.push(v & 255, v >> 8 & 255), str = s => { for (const c of s) o.push(c.charCodeAt(0)); };
  str('GIF89a'); u16(w); u16(h); o.push(0xF7, 0, 0); for (let i = 0; i < 768; i++) o.push(pal[i]);
  o.push(0x21, 0xFF, 11); str('NETSCAPE2.0'); o.push(3, 1, 0, 0, 0);   // loop forever
  const shown = new Uint8Array(w * h * 3);
  for (let f = 0; f < n; f++){
    const d = frames[f], idx = new Uint8Array(w * h); let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let p = 0, q = 0; p < w * h; p++, q += 4){
      const r = d[q], g = d[q + 1], b = d[q + 2], s = p * 3; let t = true;
      if (f === 0 || Math.abs(r - shown[s]) + Math.abs(g - shown[s + 1]) + Math.abs(b - shown[s + 2]) > TH){
        const k = lut[(r >> 3) << 10 | (g >> 3) << 5 | b >> 3], pr = pal[k * 3], pg = pal[k * 3 + 1], pb = pal[k * 3 + 2];
        if (f === 0 || pr !== shown[s] || pg !== shown[s + 1] || pb !== shown[s + 2]){ idx[p] = k; shown[s] = pr; shown[s + 1] = pg; shown[s + 2] = pb; t = false; }
      }
      if (t) idx[p] = TRANS; else { const x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    let bw, bh, data;
    if (x1 < 0){ x0 = 0; y0 = 0; bw = 1; bh = 1; data = new Uint8Array([TRANS]); }   // nothing moved: a one-pixel see-through frame just holds the time
    else { bw = x1 - x0 + 1; bh = y1 - y0 + 1; data = new Uint8Array(bw * bh); for (let y = 0; y < bh; y++) data.set(idx.subarray((y + y0) * w + x0, (y + y0) * w + x0 + bw), y * bw); }
    o.push(0x21, 0xF9, 4, 0x05, delayCs & 255, delayCs >> 8 & 255, TRANS, 0);   // keep the last frame, one colour is see-through
    o.push(0x2C); u16(x0); u16(y0); u16(bw); u16(bh); o.push(0, 8);
    const z = lzw(data); for (let i = 0; i < z.length; i += 255){ const c = Math.min(255, z.length - i); o.push(c); for (let j = 0; j < c; j++) o.push(z[i + j]); } o.push(0);
    if (progress) progress((f + 1) / n);
  }
  o.push(0x3B); return Uint8Array.from(o);
}
if (typeof module !== 'undefined') module.exports = { pnGif };
