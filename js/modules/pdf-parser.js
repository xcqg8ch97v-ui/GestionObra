/* ========================================
   PDF Parser Module
   Extrae datos de PDFs de proveedores:
   presupuestos, facturas y albaranes
   ======================================== */

const PdfParserModule = (() => {

  // ---- Text extraction via pdf.js ----
  async function extractText(arrayBuffer) {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const lines = [];
      let lastY = null;
      let currentLine = '';
      for (const item of content.items) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
          lines.push(currentLine.trim());
          currentLine = '';
        }
        currentLine += item.str + ' ';
        lastY = item.transform[5];
      }
      if (currentLine.trim()) lines.push(currentLine.trim());
      pages.push(lines);
    }
    return pages; // array of arrays of lines
  }

  // ---- Detect document type ----
  function detectType(allLines) {
    const text = allLines.join(' ').toLowerCase();
    if (/factura|invoice|n[ºo°]?\s*factura|fecha\s*factura/.test(text)) return 'factura';
    if (/albar[aá]n|nota\s*de\s*entrega|delivery\s*note/.test(text)) return 'albaran';
    // default: presupuesto/oferta
    return 'presupuesto';
  }

  // ---- Common extraction helpers ----
  const NIF_RE = /\b([A-Z]\d{7}[A-Z0-9]|\d{8}[A-Z])\b/i;
  const EMAIL_RE = /[\w.+-]+@[\w.-]+\.\w{2,}/i;
  const PHONE_RE = /(?:\+34\s?)?(?:\d[\s.-]?){9}\b/;
  const DATE_RE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
  const MONEY_RE = /(\d[\d.,]*)\s*€/;

  function findPattern(lines, re) {
    for (const line of lines) {
      const m = line.match(re);
      if (m) return m;
    }
    return null;
  }

  function findAllAmounts(lines) {
    const amounts = [];
    for (const line of lines) {
      const matches = [...line.matchAll(/(\d[\d.,]*)\s*€/g)];
      for (const m of matches) {
        const val = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
        if (!isNaN(val) && val > 0) amounts.push(val);
      }
    }
    return amounts;
  }

  function extractSupplierName(lines) {
    // Heuristic: first non-empty line that's not a date / number-only / very short
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const l = lines[i].trim();
      if (l.length < 3) continue;
      if (/^\d+[\/\-.]/.test(l)) continue; // date
      if (/^\d+$/.test(l)) continue; // just numbers
      if (/^(presupuesto|factura|albar)/i.test(l)) continue;
      return l;
    }
    return '';
  }

  // ---- Parse presupuesto / oferta ----
  function parsePresupuesto(allLines) {
    const result = {
      type: 'presupuesto',
      supplierName: '',
      nif: '',
      email: '',
      phone: '',
      date: '',
      reference: '',
      items: [],
      total: 0
    };

    const flat = allLines;
    result.supplierName = extractSupplierName(flat);

    const nifMatch = findPattern(flat, NIF_RE);
    if (nifMatch) result.nif = nifMatch[0].toUpperCase();

    const emailMatch = findPattern(flat, EMAIL_RE);
    if (emailMatch) result.email = emailMatch[0];

    const phoneMatch = findPattern(flat, PHONE_RE);
    if (phoneMatch) result.phone = phoneMatch[0].replace(/[\s.-]/g, '');

    const dateMatch = findPattern(flat, DATE_RE);
    if (dateMatch) result.date = dateMatch[0];

    // Reference / number
    const refMatch = findPattern(flat, /(?:presupuesto|oferta|ref(?:erencia)?)[:\s#nºo°]*\s*([A-Z0-9][\w\-\/]*)/i);
    if (refMatch) result.reference = refMatch[1];

    // Items: lines with amount €
    const itemRe = /^(.+?)\s+(\d[\d.,]*)\s*€/;
    for (const line of flat) {
      const m = line.match(itemRe);
      if (m) {
        const desc = m[1].trim();
        const amount = parseFloat(m[2].replace(/\./g, '').replace(',', '.'));
        if (desc.length > 2 && !isNaN(amount) && amount > 0) {
          // Skip if it's a total/subtotal line
          if (/^(total|subtotal|base\s*imponible|iva|i\.v\.a|importe)/i.test(desc)) continue;
          result.items.push({ description: desc, amount });
        }
      }
    }

    // Total: largest amount, or explicit total line
    const totalMatch = findPattern(flat, /(?:total|importe\s*total)[:\s]*(\d[\d.,]*)\s*€/i);
    if (totalMatch) {
      result.total = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'));
    } else {
      const amounts = findAllAmounts(flat);
      if (amounts.length) result.total = Math.max(...amounts);
    }

    return result;
  }

  // ---- Parse factura ----
  function parseFactura(allLines) {
    const result = {
      type: 'factura',
      supplierName: '',
      nif: '',
      email: '',
      phone: '',
      date: '',
      invoiceNumber: '',
      items: [],
      baseImponible: 0,
      iva: 0,
      ivaPercent: 0,
      total: 0
    };

    const flat = allLines;
    result.supplierName = extractSupplierName(flat);

    const nifMatch = findPattern(flat, NIF_RE);
    if (nifMatch) result.nif = nifMatch[0].toUpperCase();

    const emailMatch = findPattern(flat, EMAIL_RE);
    if (emailMatch) result.email = emailMatch[0];

    const phoneMatch = findPattern(flat, PHONE_RE);
    if (phoneMatch) result.phone = phoneMatch[0].replace(/[\s.-]/g, '');

    const dateMatch = findPattern(flat, DATE_RE);
    if (dateMatch) result.date = dateMatch[0];

    // Invoice number
    const invMatch = findPattern(flat, /(?:factura|invoice|n[ºo°]?\s*factura)[:\s#nºo°]*\s*([A-Z0-9][\w\-\/]*)/i);
    if (invMatch) result.invoiceNumber = invMatch[1];

    // Items
    const itemRe = /^(.+?)\s+(\d[\d.,]*)\s*€/;
    for (const line of flat) {
      const m = line.match(itemRe);
      if (m) {
        const desc = m[1].trim();
        const amount = parseFloat(m[2].replace(/\./g, '').replace(',', '.'));
        if (desc.length > 2 && !isNaN(amount) && amount > 0) {
          if (/^(total|subtotal|base\s*imponible|iva|i\.v\.a|importe)/i.test(desc)) continue;
          result.items.push({ description: desc, amount });
        }
      }
    }

    // Base imponible
    const baseMatch = findPattern(flat, /base\s*imponible[:\s]*(\d[\d.,]*)\s*€?/i);
    if (baseMatch) result.baseImponible = parseFloat(baseMatch[1].replace(/\./g, '').replace(',', '.'));

    // IVA
    const ivaMatch = findPattern(flat, /i\.?v\.?a\.?\s*\(?(\d+)\s*%?\)?[:\s]*(\d[\d.,]*)\s*€?/i);
    if (ivaMatch) {
      result.ivaPercent = parseInt(ivaMatch[1]);
      result.iva = parseFloat(ivaMatch[2].replace(/\./g, '').replace(',', '.'));
    }

    // Total
    const totalMatch = findPattern(flat, /(?:total|importe\s*total)[:\s]*(\d[\d.,]*)\s*€/i);
    if (totalMatch) {
      result.total = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'));
    } else {
      const amounts = findAllAmounts(flat);
      if (amounts.length) result.total = Math.max(...amounts);
    }

    return result;
  }

  // ---- Parse albarán ----
  function parseAlbaran(allLines) {
    const result = {
      type: 'albaran',
      supplierName: '',
      nif: '',
      date: '',
      deliveryNumber: '',
      items: []
    };

    const flat = allLines;
    result.supplierName = extractSupplierName(flat);

    const nifMatch = findPattern(flat, NIF_RE);
    if (nifMatch) result.nif = nifMatch[0].toUpperCase();

    const dateMatch = findPattern(flat, DATE_RE);
    if (dateMatch) result.date = dateMatch[0];

    // Delivery number
    const delMatch = findPattern(flat, /(?:albar[aá]n|nota\s*de\s*entrega)[:\s#nºo°]*\s*([A-Z0-9][\w\-\/]*)/i);
    if (delMatch) result.deliveryNumber = delMatch[1];

    // Items: look for lines with quantities
    const qtyRe = /^(.+?)\s+(\d[\d.,]*)\s*(ud|uds|unid|m[²³]?|ml|kg|l|t)\b/i;
    for (const line of flat) {
      const m = line.match(qtyRe);
      if (m) {
        result.items.push({
          description: m[1].trim(),
          quantity: parseFloat(m[2].replace(',', '.')),
          unit: m[3]
        });
      }
    }

    // Fallback: lines with €
    if (result.items.length === 0) {
      const itemRe = /^(.+?)\s+(\d[\d.,]*)\s*€/;
      for (const line of flat) {
        const m = line.match(itemRe);
        if (m) {
          const desc = m[1].trim();
          const amount = parseFloat(m[2].replace(/\./g, '').replace(',', '.'));
          if (desc.length > 2 && !isNaN(amount) && amount > 0) {
            if (/^(total|subtotal)/i.test(desc)) continue;
            result.items.push({ description: desc, amount });
          }
        }
      }
    }

    return result;
  }

  // ---- Main parse entry ----
  async function parse(arrayBuffer) {
    const pages = await extractText(arrayBuffer);
    const allLines = pages.flat();
    const type = detectType(allLines);

    switch (type) {
      case 'factura': return parseFactura(allLines);
      case 'albaran': return parseAlbaran(allLines);
      default: return parsePresupuesto(allLines);
    }
  }

  return { parse, extractText, detectType };
})();
