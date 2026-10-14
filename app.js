/* Shop Manager - hardware & cement shop. No backend: data lives in localStorage. */
const KEY = 'shopmgr_v1';
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const inr = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(+n || 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => new Date().toISOString().slice(0, 10);
const num = v => parseFloat(v) || 0;

/* ---------- state ---------- */
function seed() {
  const p = (name, category, unit, cost, price, stock, min) => ({ id: uid(), name, category, unit, cost, price, stock, min });
  return {
    sample: true,
    settings: { shop: 'My Hardware & Cement Shop', phone: '', address: '', gstin: '', gst: 0 },
    products: [
      p('Cement OPC 53 (50kg)', 'Cement', 'bag', 340, 385, 120, 30),
      p('Cement PPC (50kg)', 'Cement', 'bag', 320, 365, 80, 30),
      p('TMT Bar 12mm', 'Steel', 'kg', 58, 66, 900, 200),
      p('Binding Wire', 'Steel', 'kg', 70, 85, 40, 15),
      p('Red Bricks', 'Building', 'pcs', 6, 8, 5000, 1000),
      p('River Sand', 'Building', 'ton', 900, 1200, 12, 3),
      p('PVC Pipe 1"', 'Plumbing', 'pcs', 110, 140, 60, 15),
      p('Wall Putty (20kg)', 'Paint', 'bag', 620, 720, 25, 8),
      p('Nails 3"', 'Hardware', 'kg', 75, 95, 30, 10),
      p('Hammer', 'Tools', 'pcs', 180, 250, 6, 3)
    ],
    customers: [], sales: [], orders: [], payments: [], seq: { inv: 1 }
  };
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.products) return d;
  } catch (e) { /* ignore */ }
  return seed();
}
let S = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const prod = id => S.products.find(p => p.id === id);
const cust = id => S.customers.find(c => c.id === id);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- dialog helper ---------- */
function openForm(title, html, onSubmit, okText = 'Save') {
  $('#dlgTitle').textContent = title;
  $('#dlgBody').innerHTML = html;
  $('#dlgOk').textContent = okText;
  const dlg = $('#dlg'), form = $('#dlgForm');
  form.onsubmit = e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (onSubmit(data) !== false) dlg.close();
  };
  $('#dlgCancel').onclick = () => dlg.close();
  dlg.showModal();
}
const field = (label, name, val = '', type = 'text', extra = '') =>
  `<div style="margin-bottom:10px"><label class="f">${label}</label><input name="${name}" type="${type}" value="${esc(val)}" ${extra}></div>`;

/* ---------- derived numbers ---------- */
function custBalance(id) {
  const due = S.sales.filter(s => s.custId === id).reduce((a, s) => a + (s.total - s.paid), 0);
  const paid = S.payments.filter(p => p.custId === id).reduce((a, p) => a + p.amount, 0);
  return due - paid;
}
const inRange = (d, from) => d >= from;
function salesSum(from) { return S.sales.filter(s => inRange(s.date, from)).reduce((a, s) => a + s.total, 0); }
function profitSum(from) {
  return S.sales.filter(s => inRange(s.date, from)).reduce((a, s) =>
    a + s.items.reduce((x, i) => x + (i.price - i.cost) * i.qty, 0) - (s.discount || 0), 0);
}

/* ---------- views ---------- */
const views = { dashboard, billing, sales, inventory, orders, customers, settings };
let current = 'dashboard';
function go(v) {
  current = v;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('#title').textContent = { dashboard: 'Dashboard', billing: 'New Bill', sales: 'Sales', inventory: 'Inventory', orders: 'Orders', customers: 'Customers', settings: 'Settings' }[v];
  $('#sidebar').classList.remove('open');
  views[v]();
}

/* Dashboard */
function dashboard() {
  const t = todayStr();
  const monthStart = t.slice(0, 8) + '01';
  const low = S.products.filter(p => p.stock <= p.min);
  const pending = S.orders.filter(o => o.status === 'Pending' || o.status === 'Dispatched');
  const dues = S.customers.reduce((a, c) => a + Math.max(0, custBalance(c.id)), 0);
  const stockVal = S.products.reduce((a, p) => a + p.stock * p.cost, 0);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    days.push({ ds, label: d.toLocaleDateString('en-IN', { weekday: 'short' }), v: S.sales.filter(s => s.date === ds).reduce((a, s) => a + s.total, 0) });
  }
  const max = Math.max(...days.map(d => d.v), 1);

  const sold = {};
  S.sales.forEach(s => s.items.forEach(i => { sold[i.name] = (sold[i.name] || 0) + i.qty * i.price; }));
  const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5);

  $('#view').innerHTML = `
  <div class="grid stats">
    <div class="card stat"><div class="lbl">Today's sales</div><div class="val">${inr(salesSum(t))}</div><div class="sub">Profit ${inr(profitSum(t))}</div></div>
    <div class="card stat"><div class="lbl">This month</div><div class="val">${inr(salesSum(monthStart))}</div><div class="sub">Profit ${inr(profitSum(monthStart))}</div></div>
    <div class="card stat"><div class="lbl">Customer dues</div><div class="val ${dues ? 'warn' : ''}">${inr(dues)}</div><div class="sub">Udhaar to collect</div></div>
    <div class="card stat"><div class="lbl">Stock value</div><div class="val">${inr(stockVal)}</div><div class="sub">${S.products.length} products</div></div>
    <div class="card stat"><div class="lbl">Low stock</div><div class="val ${low.length ? 'bad' : 'ok'}">${low.length}</div><div class="sub">items to reorder</div></div>
    <div class="card stat"><div class="lbl">Open orders</div><div class="val">${pending.length}</div><div class="sub">pending / dispatched</div></div>
  </div>
  <div class="grid cols2">
    <div class="card"><h3>Last 7 days sales</h3>
      <div class="bars">${days.map(d => `<div class="bar"><b>${d.v ? Math.round(d.v / 100) / 10 + 'k' : ''}</b><i style="height:${(d.v / max) * 100}%"></i>${d.label}</div>`).join('')}</div></div>
    <div class="card"><h3>Top selling (by value)</h3>
      ${top.length ? `<ul class="list">${top.map(([n, v]) => `<li><span>${esc(n)}</span><b>${inr(v)}</b></li>`).join('')}</ul>` : '<div class="empty">No sales yet</div>'}</div>
    <div class="card"><h3>⚠️ Low stock</h3>
      ${low.length ? `<ul class="list">${low.map(p => `<li><span>${esc(p.name)}</span><b class="bad">${p.stock} ${esc(p.unit)} <span class="muted">(min ${p.min})</span></b></li>`).join('')}</ul>` : '<div class="empty">All stocked up 👍</div>'}</div>
    <div class="card"><h3>Recent sales</h3>
      ${S.sales.length ? `<ul class="list">${S.sales.slice(-6).reverse().map(s => `<li><span>#${s.no} · ${esc(s.custName)}</span><b>${inr(s.total)}</b></li>`).join('')}</ul>` : '<div class="empty">No sales yet</div>'}</div>
  </div>`;
}

/* Inventory */
let invQ = '', invCat = '';
function inventory() {
  const cats = [...new Set(S.products.map(p => p.category))].sort();
  const rows = S.products.filter(p => (!invCat || p.category === invCat) && p.name.toLowerCase().includes(invQ.toLowerCase()));
  $('#view').innerHTML = `
  <div class="toolbar">
    <input id="q" placeholder="Search product…" value="${esc(invQ)}">
    <select id="cat"><option value="">All categories</option>${cats.map(c => `<option ${c === invCat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
    <span class="sp"></span>
    <button class="btn ghost" id="exp">⬇ CSV</button>
    <button class="btn" id="add">+ Add product</button>
  </div>
  <div class="tablewrap"><table>
    <tr><th>Product</th><th>Category</th><th class="num">Stock</th><th class="num">Cost</th><th class="num">Price</th><th class="num">Value</th><th></th></tr>
    ${rows.map(p => `<tr>
      <td>${esc(p.name)}</td><td>${esc(p.category)}</td>
      <td class="num ${p.stock <= p.min ? 'bad' : ''}"><b>${p.stock}</b> ${esc(p.unit)}${p.stock <= p.min ? ' ⚠️' : ''}</td>
      <td class="num">${inr(p.cost)}</td><td class="num">${inr(p.price)}</td><td class="num">${inr(p.stock * p.cost)}</td>
      <td><div class="act"><button class="btn sm ghost" data-stock="${p.id}">+Stock</button><button class="btn sm ghost" data-edit="${p.id}">Edit</button><button class="btn sm danger" data-del="${p.id}">✕</button></div></td></tr>`).join('') || `<tr><td colspan="7" class="empty">No products</td></tr>`}
  </table></div>`;
  $('#q').oninput = e => { invQ = e.target.value; inventory(); $('#q').focus(); $('#q').setSelectionRange(invQ.length, invQ.length); };
  $('#cat').onchange = e => { invCat = e.target.value; inventory(); };
  $('#add').onclick = () => productForm();
  $('#exp').onclick = () => downloadCSV('inventory.csv', [['Name', 'Category', 'Unit', 'Cost', 'Price', 'Stock', 'Min'], ...S.products.map(p => [p.name, p.category, p.unit, p.cost, p.price, p.stock, p.min])]);
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => productForm(prod(b.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('Delete this product?')) { S.products = S.products.filter(p => p.id !== b.dataset.del); save(); inventory(); } });
  document.querySelectorAll('[data-stock]').forEach(b => b.onclick = () => {
    const p = prod(b.dataset.stock);
    openForm('Add stock – ' + p.name, field(`Quantity received (${esc(p.unit)})`, 'qty', '', 'number', 'step="any" required min="0"') + field('New cost price (optional)', 'cost', '', 'number', 'step="any"'), d => {
      p.stock += num(d.qty); if (d.cost) p.cost = num(d.cost); save(); inventory(); toast('Stock updated');
    });
  });
}
function productForm(p) {
  const e = p || { name: '', category: '', unit: 'pcs', cost: '', price: '', stock: 0, min: 5 };
  const cats = [...new Set(S.products.map(x => x.category))];
  openForm(p ? 'Edit product' : 'Add product',
    field('Name', 'name', e.name, 'text', 'required') +
    `<datalist id="cl">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>` +
    field('Category (Cement, Steel, Paint, Plumbing…)', 'category', e.category, 'text', 'required list="cl"') +
    `<div class="row">${field('Unit (bag, kg, pcs, ft…)', 'unit', e.unit, 'text', 'required')}${field('Opening stock', 'stock', e.stock, 'number', 'step="any" required')}</div>` +
    `<div class="row">${field('Cost price ₹', 'cost', e.cost, 'number', 'step="any" required')}${field('Selling price ₹', 'price', e.price, 'number', 'step="any" required')}</div>` +
    field('Low-stock alert at', 'min', e.min, 'number', 'step="any"'),
    d => {
      const obj = { name: d.name.trim(), category: d.category.trim(), unit: d.unit.trim(), cost: num(d.cost), price: num(d.price), stock: num(d.stock), min: num(d.min) };
      if (p) Object.assign(p, obj); else S.products.push({ id: uid(), ...obj });
      save(); inventory(); toast('Saved');
    });
}

/* Billing */
let cart = [];
function billing() {
  const opts = S.products.map(p => `<option value="${p.id}">${esc(p.name)} — ${inr(p.price)} (${p.stock} ${esc(p.unit)})</option>`).join('');
  $('#view').innerHTML = `
  <div class="billing">
    <div class="card">
      <h3>Add items</h3>
      <div class="row">
        <div><label class="f">Product</label><select id="bp">${opts}</select></div>
        <div><label class="f">Qty</label><input id="bq" type="number" step="any" min="0" value="1"></div>
        <div style="align-self:end"><button class="btn" id="badd" style="width:100%">Add</button></div>
      </div>
      <div class="tablewrap" style="margin-top:8px"><table id="cartTbl"></table></div>
    </div>
    <div class="card">
      <h3>Customer & payment</h3>
      <label class="f">Customer</label>
      <select id="bc"><option value="">Walk-in customer</option>${S.customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <div class="row" style="margin-top:10px">
        <div><label class="f">Discount ₹</label><input id="bd" type="number" step="any" min="0" value="0"></div>
        <div><label class="f">GST %</label><input id="bg" type="number" step="any" min="0" value="${S.settings.gst}"></div>
      </div>
      <div class="totals" id="tot"></div>
      <div class="row" style="margin-top:10px">
        <div><label class="f">Paid now ₹</label><input id="bpaid" type="number" step="any" min="0"></div>
        <div><label class="f">Mode</label><select id="bm"><option>Cash</option><option>UPI</option><option>Card</option><option>Credit (Udhaar)</option></select></div>
      </div>
      <button class="btn" id="bsave" style="width:100%;margin-top:6px">Save & Print Bill</button>
    </div>
  </div>`;
  $('#badd').onclick = () => {
    const p = prod($('#bp').value); const q = num($('#bq').value);
    if (!p || q <= 0) return;
    const ex = cart.find(i => i.pid === p.id);
    if (ex) ex.qty += q; else cart.push({ pid: p.id, name: p.name, unit: p.unit, qty: q, price: p.price, cost: p.cost });
    drawCart();
  };
  ['bd', 'bg'].forEach(i => $('#' + i).oninput = drawCart);
  $('#bsave').onclick = saveBill;
  drawCart();
}
function totals() {
  const sub = cart.reduce((a, i) => a + i.qty * i.price, 0);
  const disc = num($('#bd')?.value);
  const gstPct = num($('#bg')?.value);
  const taxable = Math.max(0, sub - disc);
  const gst = taxable * gstPct / 100;
  return { sub, disc, gstPct, gst, total: Math.round(taxable + gst) };
}
function drawCart() {
  $('#cartTbl').innerHTML = cart.length ? `<tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th><th></th></tr>` +
    cart.map((i, n) => `<tr><td>${esc(i.name)}</td>
      <td class="num"><input data-q="${n}" type="number" step="any" value="${i.qty}" style="width:80px;text-align:right"> ${esc(i.unit)}</td>
      <td class="num"><input data-r="${n}" type="number" step="any" value="${i.price}" style="width:90px;text-align:right"></td>
      <td class="num">${inr(i.qty * i.price)}</td><td><button class="btn sm danger" data-x="${n}">✕</button></td></tr>`).join('')
    : `<tr><td class="empty">Cart is empty</td></tr>`;
  document.querySelectorAll('[data-q]').forEach(el => el.onchange = () => { cart[el.dataset.q].qty = num(el.value); drawCart(); });
  document.querySelectorAll('[data-r]').forEach(el => el.onchange = () => { cart[el.dataset.r].price = num(el.value); drawCart(); });
  document.querySelectorAll('[data-x]').forEach(el => el.onclick = () => { cart.splice(el.dataset.x, 1); drawCart(); });
  const t = totals();
  $('#tot').innerHTML = `<div><span>Subtotal</span><span>${inr(t.sub)}</span></div>
    <div><span>Discount</span><span>− ${inr(t.disc)}</span></div>
    <div><span>GST (${t.gstPct}%)</span><span>${inr(t.gst)}</span></div>
    <div class="grand"><span>Total</span><span>${inr(t.total)}</span></div>`;
}
function saveBill() {
  if (!cart.length) return toast('Add at least one item');
  for (const i of cart) {
    const p = prod(i.pid);
    if (p && i.qty > p.stock && !confirm(`Only ${p.stock} ${p.unit} of "${p.name}" in stock. Continue anyway?`)) return;
  }
  const t = totals();
  const cid = $('#bc').value;
  const mode = $('#bm').value;
  let paid = $('#bpaid').value === '' ? (mode.startsWith('Credit') ? 0 : t.total) : num($('#bpaid').value);
  paid = Math.min(paid, t.total);
  if (!cid && paid < t.total) return toast('Walk-in customers must pay in full. Pick a customer for udhaar.');
  const sale = {
    id: uid(), no: S.seq.inv++, date: todayStr(), custId: cid || null,
    custName: cid ? cust(cid).name : 'Walk-in', items: cart.map(i => ({ ...i })),
    discount: t.disc, gstPct: t.gstPct, gst: t.gst, subtotal: t.sub, total: t.total, paid, mode
  };
  sale.items.forEach(i => { const p = prod(i.pid); if (p) p.stock = Math.max(0, p.stock - i.qty); });
  S.sales.push(sale); save(); cart = [];
  toast('Bill #' + sale.no + ' saved');
  printInvoice(sale);
  go('billing');
}
function printInvoice(s) {
  const st = S.settings;
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to print bills');
  w.document.write(`<html><head><title>Invoice ${s.no}</title><style>
    body{font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:auto;color:#111}
    h2{margin:0}table{width:100%;border-collapse:collapse;margin:14px 0}th,td{border-bottom:1px solid #ccc;padding:6px;text-align:left}
    .r{text-align:right}.t div{display:flex;justify-content:space-between;padding:3px 0}.g{font-weight:700;font-size:18px;border-top:2px solid #000}
  </style></head><body>
  <h2>${esc(st.shop)}</h2><div>${esc(st.address)} ${st.phone ? '· ' + esc(st.phone) : ''}</div>${st.gstin ? `<div>GSTIN: ${esc(st.gstin)}</div>` : ''}
  <hr><div><b>Invoice #${s.no}</b> · ${s.date}<br>Customer: ${esc(s.custName)}</div>
  <table><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>
  ${s.items.map(i => `<tr><td>${esc(i.name)}</td><td class="r">${i.qty} ${esc(i.unit)}</td><td class="r">${inr(i.price)}</td><td class="r">${inr(i.qty * i.price)}</td></tr>`).join('')}</table>
  <div class="t"><div><span>Subtotal</span><span>${inr(s.subtotal)}</span></div>
  <div><span>Discount</span><span>− ${inr(s.discount)}</span></div>
  <div><span>GST (${s.gstPct}%)</span><span>${inr(s.gst)}</span></div>
  <div class="g"><span>Total</span><span>${inr(s.total)}</span></div>
  <div><span>Paid (${esc(s.mode)})</span><span>${inr(s.paid)}</span></div>
  <div><span>Balance due</span><span>${inr(s.total - s.paid)}</span></div></div>
  <p style="text-align:center;margin-top:30px">Thank you! Visit again.</p>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

/* Sales */
let salesFrom = '', salesTo = '';
function sales() {
  const rows = S.sales.filter(s => (!salesFrom || s.date >= salesFrom) && (!salesTo || s.date <= salesTo)).slice().reverse();
  const total = rows.reduce((a, s) => a + s.total, 0);
  $('#view').innerHTML = `
  <div class="toolbar">
    <label class="muted">From</label><input type="date" id="sf" value="${salesFrom}">
    <label class="muted">To</label><input type="date" id="st" value="${salesTo}">
    <span class="sp"></span><b>Total: ${inr(total)}</b>
    <button class="btn ghost" id="exp">⬇ CSV</button>
  </div>
  <div class="tablewrap"><table>
    <tr><th>#</th><th>Date</th><th>Customer</th><th>Items</th><th class="num">Total</th><th class="num">Paid</th><th>Status</th><th></th></tr>
    ${rows.map(s => `<tr><td>${s.no}</td><td>${s.date}</td><td>${esc(s.custName)}</td><td>${s.items.length}</td>
      <td class="num">${inr(s.total)}</td><td class="num">${inr(s.paid)}</td>
      <td>${s.total - s.paid > 0.5 ? `<span class="badge warn">Due ${inr(s.total - s.paid)}</span>` : '<span class="badge ok">Paid</span>'}</td>
      <td><div class="act"><button class="btn sm ghost" data-p="${s.id}">Print</button><button class="btn sm danger" data-d="${s.id}">Delete</button></div></td></tr>`).join('') || `<tr><td colspan="8" class="empty">No sales found</td></tr>`}
  </table></div>`;
  $('#sf').onchange = e => { salesFrom = e.target.value; sales(); };
  $('#st').onchange = e => { salesTo = e.target.value; sales(); };
  $('#exp').onclick = () => downloadCSV('sales.csv', [['Invoice', 'Date', 'Customer', 'Total', 'Paid', 'Mode'], ...rows.map(s => [s.no, s.date, s.custName, s.total, s.paid, s.mode])]);
  document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => printInvoice(S.sales.find(s => s.id === b.dataset.p)));
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
    if (!confirm('Delete this bill and return items to stock?')) return;
    const s = S.sales.find(x => x.id === b.dataset.d);
    s.items.forEach(i => { const p = prod(i.pid); if (p) p.stock += i.qty; });
    S.sales = S.sales.filter(x => x !== s); save(); sales();
  });
}

/* Orders */
const STATUS = ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];
const sBadge = s => ({ Pending: 'warn', Dispatched: 'info', Delivered: 'ok', Cancelled: 'bad' }[s]);
function orders() {
  const rows = S.orders.slice().sort((a, b) => (a.delivery || '9').localeCompare(b.delivery || '9'));
  $('#view').innerHTML = `
  <div class="toolbar"><span class="sp"></span><button class="btn" id="add">+ New order</button></div>
  <div class="tablewrap"><table>
    <tr><th>Customer</th><th>Items</th><th>Delivery</th><th>Address</th><th class="num">Total</th><th class="num">Advance</th><th>Status</th><th></th></tr>
    ${rows.map(o => `<tr><td>${esc(o.name)}<div class="muted">${esc(o.phone)}</div></td>
      <td style="white-space:normal;min-width:160px">${esc(o.items)}</td><td>${o.delivery || '-'}</td>
      <td style="white-space:normal;min-width:120px">${esc(o.address)}</td>
      <td class="num">${inr(o.total)}</td><td class="num">${inr(o.advance)}</td>
      <td><select data-s="${o.id}" style="width:auto">${STATUS.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      <td><div class="act"><button class="btn sm ghost" data-e="${o.id}">Edit</button><button class="btn sm danger" data-d="${o.id}">✕</button></div></td></tr>`).join('') || `<tr><td colspan="8" class="empty">No orders yet</td></tr>`}
  </table></div>`;
  $('#add').onclick = () => orderForm();
  document.querySelectorAll('[data-s]').forEach(el => el.onchange = () => { S.orders.find(o => o.id === el.dataset.s).status = el.value; save(); orders(); });
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => orderForm(S.orders.find(o => o.id === b.dataset.e)));
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { if (confirm('Delete order?')) { S.orders = S.orders.filter(o => o.id !== b.dataset.d); save(); orders(); } });
}
function orderForm(o) {
  const e = o || { name: '', phone: '', items: '', address: '', delivery: '', total: '', advance: 0, status: 'Pending' };
  openForm(o ? 'Edit order' : 'New order',
    `<div class="row">${field('Customer name', 'name', e.name, 'text', 'required')}${field('Phone', 'phone', e.phone, 'tel')}</div>` +
    `<div style="margin-bottom:10px"><label class="f">Items (e.g. 100 bags OPC cement, 2 ton sand)</label><textarea name="items" rows="3" required>${esc(e.items)}</textarea></div>` +
    field('Delivery address', 'address', e.address) +
    `<div class="row">${field('Delivery date', 'delivery', e.delivery, 'date')}${field('Order total ₹', 'total', e.total, 'number', 'step="any"')}${field('Advance ₹', 'advance', e.advance, 'number', 'step="any"')}</div>`,
    d => {
      const obj = { name: d.name.trim(), phone: d.phone, items: d.items, address: d.address, delivery: d.delivery, total: num(d.total), advance: num(d.advance) };
      if (o) Object.assign(o, obj); else S.orders.push({ id: uid(), status: 'Pending', created: todayStr(), ...obj });
      save(); orders(); toast('Order saved');
    });
}

/* Customers */
function customers() {
  $('#view').innerHTML = `
  <div class="toolbar"><span class="sp"></span><button class="btn" id="add">+ Add customer</button></div>
  <div class="tablewrap"><table>
    <tr><th>Name</th><th>Phone</th><th>Address</th><th class="num">Balance due</th><th></th></tr>
    ${S.customers.map(c => { const b = custBalance(c.id); return `<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.address)}</td>
      <td class="num ${b > 0 ? 'warn' : ''}"><b>${inr(b)}</b></td>
      <td><div class="act"><button class="btn sm" data-pay="${c.id}">Receive ₹</button><button class="btn sm ghost" data-l="${c.id}">Ledger</button><button class="btn sm danger" data-d="${c.id}">✕</button></div></td></tr>`; }).join('') || `<tr><td colspan="5" class="empty">No customers yet. Add regular / credit customers here.</td></tr>`}
  </table></div>`;
  $('#add').onclick = () => openForm('Add customer', field('Name', 'name', '', 'text', 'required') + field('Phone', 'phone', '', 'tel') + field('Address', 'address'), d => {
    S.customers.push({ id: uid(), name: d.name.trim(), phone: d.phone, address: d.address }); save(); customers();
  });
  document.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => {
    const c = cust(b.dataset.pay);
    openForm('Payment from ' + c.name, `<p class="muted">Current due: ${inr(custBalance(c.id))}</p>` + field('Amount received ₹', 'amt', '', 'number', 'step="any" required min="0"'), d => {
      S.payments.push({ id: uid(), custId: c.id, date: todayStr(), amount: num(d.amt) }); save(); customers(); toast('Payment recorded');
    });
  });
  document.querySelectorAll('[data-l]').forEach(b => b.onclick = () => ledger(cust(b.dataset.l)));
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { if (confirm('Delete customer? Their past bills stay in Sales.')) { S.customers = S.customers.filter(c => c.id !== b.dataset.d); save(); customers(); } });
}
function ledger(c) {
  const ev = [
    ...S.sales.filter(s => s.custId === c.id).map(s => ({ d: s.date, t: `Bill #${s.no}`, dr: s.total, cr: s.paid })),
    ...S.payments.filter(p => p.custId === c.id).map(p => ({ d: p.date, t: 'Payment received', dr: 0, cr: p.amount }))
  ].sort((a, b) => a.d.localeCompare(b.d));
  let bal = 0;
  openForm('Ledger – ' + c.name,
    `<div style="max-height:50vh;overflow:auto"><table><tr><th>Date</th><th>Detail</th><th class="num">Billed</th><th class="num">Paid</th><th class="num">Balance</th></tr>
    ${ev.map(e => { bal += e.dr - e.cr; return `<tr><td>${e.d}</td><td>${e.t}</td><td class="num">${inr(e.dr)}</td><td class="num">${inr(e.cr)}</td><td class="num">${inr(bal)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">No transactions</td></tr>'}</table></div>`,
    () => true, 'Close');
}

/* Settings */
function settings() {
  const s = S.settings;
  $('#view').innerHTML = `
  <div class="grid cols2">
    <div class="card"><h3>Shop details (printed on bills)</h3>
      <form id="sf">
        ${field('Shop name', 'shop', s.shop)}${field('Phone', 'phone', s.phone)}${field('Address', 'address', s.address)}
        ${field('GSTIN (optional)', 'gstin', s.gstin)}${field('Default GST %', 'gst', s.gst, 'number', 'step="any"')}
        <button class="btn">Save</button>
      </form></div>
    <div class="card"><h3>Backup & data</h3>
      <p class="muted">All data is stored only in this browser. Download a backup often, and restore it on another device.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="bk">⬇ Download backup</button>
        <button class="btn ghost" id="rs">⬆ Restore backup</button>
        <input type="file" id="file" accept=".json" hidden>
      </div>
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
      <button class="btn danger" id="wipe">Delete ALL data (start fresh)</button>
    </div>
  </div>`;
  $('#sf').onsubmit = e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    S.settings = { shop: d.shop, phone: d.phone, address: d.address, gstin: d.gstin, gst: num(d.gst) };
    save(); applyBrand(); toast('Saved');
  };
  $('#bk').onclick = () => download('shop-backup-' + todayStr() + '.json', JSON.stringify(S, null, 2), 'application/json');
  $('#rs').onclick = () => $('#file').click();
  $('#file').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result); if (!d.products) throw 0; S = d; save(); applyBrand(); toast('Backup restored'); go('dashboard'); } catch { toast('Invalid backup file'); } };
    r.readAsText(f);
  };
  $('#wipe').onclick = () => {
    if (!confirm('This deletes everything. Continue?')) return;
    S = { sample: false, settings: { ...s }, products: [], customers: [], sales: [], orders: [], payments: [], seq: { inv: 1 } };
    save(); toast('All data cleared'); go('dashboard');
  };
}

/* ---------- utils ---------- */
function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function downloadCSV(name, rows) {
  download(name, rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
}
function applyBrand() { $('#brandName').textContent = '🏗️ ' + (S.settings.shop || 'Shop Manager'); document.title = S.settings.shop || 'Shop Manager'; }

/* ---------- boot ---------- */
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => go(b.dataset.view));
$('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
$('#today').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
applyBrand(); save(); go('dashboard');
