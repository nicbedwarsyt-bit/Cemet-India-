# Shop Manager – Hardware & Cement Shop

A simple web app to run your shop: **dashboard stats, inventory, billing/sales, orders, customer udhaar ledger**, backups and printable invoices. No server or database needed – it runs in the browser and can be hosted free on GitHub Pages.

## Features
- 📊 **Dashboard** – today/month sales & profit, customer dues, stock value, low-stock alerts, 7-day chart, top sellers
- 📦 **Inventory** – products with category, unit (bag/kg/pcs/ton), cost, price, stock, low-stock level, add stock, CSV export
- 🧾 **Billing** – cart, editable rate, discount, GST, partial payment/udhaar, auto stock deduction, print invoice
- 💰 **Sales** – date filter, reprint, delete (returns stock), CSV export
- 🚚 **Orders** – customer orders with delivery date, advance, status (Pending → Dispatched → Delivered)
- 👥 **Customers** – credit balances, receive payments, full ledger
- ⚙️ **Settings** – shop name/GSTIN on bills, backup & restore (JSON)

## Put it on GitHub (step by step)
1. Create a new repository on github.com (e.g. `shop-manager`).
2. Upload all files from this folder (`index.html`, `style.css`, `app.js`, `.github/`), or:
   ```bash
   git init
   git add .
   git commit -m "Shop manager"
   git branch -M main
   git remote add origin https://github.com/<your-username>/shop-manager.git
   git push -u origin main
   ```
3. In the repo go to **Settings → Pages → Source: GitHub Actions**.
4. After the workflow finishes, your site is live at `https://<your-username>.github.io/shop-manager/`.

## Important notes
- Data is stored in the **browser's localStorage** of the device you use. It is *not* shared between phone and computer. Use **Settings → Download backup** regularly and restore on other devices.
- If your repo is public, the *code* is public but your shop data is not (it never leaves your browser).
- Sample products are preloaded – delete them or use **Settings → Delete ALL data**.

## Next steps (if you outgrow this)
Multi-device sync and staff logins need a backend (e.g. Supabase or Firebase). The app is structured so storage can be swapped by replacing `load()` / `save()` in `app.js`.
