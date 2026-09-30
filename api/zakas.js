// ============================================================
//  GET /api/zakas?t=<token> — MIJOZ uchun ochiq "zakas holati"
// ------------------------------------------------------------
//  Chekdagi QR shu tokenga ishora qiladi. Loginsiz ochiladi,
//  shuning uchun mijozga FAQAT o'z zakasining qisqa ma'lumoti
//  qaytariladi: holat, sana, tovarlar (narxsiz) va umumiy summa.
//  Butun zakaslar ro'yxati hech qachon brauzerga tushmaydi.
// ============================================================
import { getDb, readShop } from './_firebase.js';

// Bitta tovar qatori: nomi + o'lchovi (Zakazlar.jsx dagi itemDisp bilan bir xil).
// Eski format (nomi yo'q, tunikaName/productUnit bor) ham qo'llab-quvvatlanadi.
function qatorOf(it) {
  if (it.nomi !== undefined) {
    const olchov = (it.kind === 'aksessuar' || it.kind === 'kazirok')
      ? `${it.soni || 0} ${it.birlik || 'dona'}`
      : it.kind === 'metrli'
        ? `${it.jamiMeyor || it.uzunlik || 0} metr`
        : `${it.uzunlik || 0} metr × ${it.soni || 0} dona`;
    return { nomi: it.nomi || '', olchov };
  }
  // eski format
  const olchov = it.productUnit === 'kvadrat'
    ? `${it.uzunlik || 0}x${it.eni || 0}x${it.soni || 0}`
    : `${it.uzunlik || 0}x${it.soni || 0}`;
  return { nomi: it.tunikaName || it.productName || '', olchov };
}

// 'shop-phone' qiymati → sotuvchilar [{ ism, tel: [] }] (src/lib/sotuvchi.js
// sotuvchilarOl bilan bir xil qoida; api src/ dan import qilmaydi).
// Satr: "Ism: raqam1, raqam2 | raqam3" (eski bitta raqam ham shu satr);
// massiv [{ id, ism, tel: [...] }] — qisqa muddat yozilgan format.
function sotuvchilarOl(v) {
  if (Array.isArray(v)) {
    return v
      .filter((s) => s && typeof s === 'object')
      .map((s) => ({
        ism: String(s.ism || '').trim(),
        tel: (Array.isArray(s.tel) ? s.tel : [s.tel])
          .map((t) => String(t == null ? '' : t).trim())
          .filter(Boolean),
      }))
      .filter((s) => s.ism || s.tel.length);
  }
  const t = v == null || typeof v === 'object' ? '' : String(v).trim();
  if (!t) return [];
  return t.split('|').map((qism) => {
    const q = qism.trim();
    const k = q.lastIndexOf(':');
    return {
      ism: k >= 0 ? q.slice(0, k).trim() : '',
      tel: (k >= 0 ? q.slice(k + 1) : q).split(/[,;]/).map((x) => x.trim()).filter(Boolean),
    };
  }).filter((s) => s.ism || s.tel.length);
}

// Zakasni saqlashda tanlangan sotuvchi (o.sotuvchi — ismi yoki 1-raqami) birinchi;
// topilmasa — Sozlamalardagi tartib (src/lib/sotuvchi.js sotuvchilarTartib bilan bir xil).
function sotuvchilarTartib(l, kalit) {
  const teng = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const i = kalit ? l.findIndex((s) => teng(s.ism, kalit) || s.tel.some((t) => teng(t, kalit))) : -1;
  return i > 0 ? [l[i], ...l.slice(0, i), ...l.slice(i + 1)] : l;
}

// Kazirok qatorining nomi (KazirokSavdo.jsx dagi kazRowNom bilan bir xil)
function kazNom(r) {
  if (r.nom) return r.nom;
  if (r.kind === 'qoz') return r.ctype === 'in' ? 'Ichki burchak qozon' : 'Tashqi burchak qozon';
  const s = r.sizeLabel || '';
  const hasPat = s.includes('Patalok'), hasPal = s.includes('Paloska');
  if (hasPat && !hasPal) return 'Patalok';
  if (hasPal && !hasPat) return 'Paloska';
  return 'Kazirok';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'faqat GET' });
  res.setHeader('Cache-Control', 'no-store');

  const token = String((req.query && (req.query.t || req.query.token)) || '').trim();
  if (!token) return res.status(400).json({ ok: false, error: "token yo'q" });

  try {
    const db = await getDb();
    const orders = (await readShop(db, 'orders')) || [];
    const o = (Array.isArray(orders) ? orders : []).find((x) => x && x.viewToken === token);
    if (!o) return res.status(404).json({ ok: false, error: 'topilmadi' });

    const qatorlar = [];
    for (const it of (Array.isArray(o.items) ? o.items : [])) {
      if (!it) continue;
      qatorlar.push(qatorOf(it));
    }
    for (const r of (Array.isArray(o.kazRows) ? o.kazRows : [])) {
      if (!r) continue;
      // "Patalok · Oq list · 1.2x2m" — bo'sh bo'laklar tushib qoladi
      const bolaklar = [kazNom(r), r.listNom, r.sizeLabel].filter(Boolean);
      qatorlar.push({
        nomi: bolaklar.join(' · '),
        olchov: `${(Number(r.metr) || 0).toFixed(2)} m`,
      });
    }

    const nomi = (await readShop(db, 'shop-name')) || '';
    const sotuvchilar = sotuvchilarTartib(sotuvchilarOl(await readShop(db, 'shop-phone')), o.sotuvchi);
    // Eski mijoz sahifasi (keshdagi) uchun — birinchi raqam
    const telefon = (sotuvchilar.find((s) => s.tel.length) || { tel: [''] }).tel[0];

    return res.status(200).json({
      ok: true,
      zakas: {
        number: o.number || '',
        createdAt: o.createdAt || null,
        muddat: o.muddat || null,
        holat: o.holat || 'jarayon',
        status: o.status || null,
        mijoz: (o.customer && o.customer.name) || '',
        usta: o.masterName || '',
        totalSum: Number(o.totalSum) || 0,
        totalPaid: Number(o.totalPaid) || 0,
        debt: Number(o.debt) || 0,
        qatorlar,
      },
      dokon: { nomi: String(nomi || ''), telefon: String(telefon || ''), sotuvchilar },
    });
  } catch (e) {
    // Ichki xato matni ommaviy sahifaga chiqmasin — faqat serverda qoladi
    console.error('zakas error:', e);
    return res.status(500).json({ ok: false, error: 'server xatosi' });
  }
}
