const fs = require('fs');
const path = require('path');

// Cargar pdf.js desde node_modules
const pdfjsLib = require('pdfjs-dist/build/pdf.mjs');

async function extractText(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
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
  
  return pages;
}

async function testPDF() {
  const pdfPath = path.join(__dirname, '29-04-2026_IZA_AUT. 1_FIRM.pdf');
  
  try {
    const pages = await extractText(pdfPath);
    console.log(`\n=== PDF: ${pdfPath} ===`);
    console.log(`Total páginas: ${pages.length}\n`);
    
    pages.forEach((pageLines, pageIndex) => {
      console.log(`--- Página ${pageIndex + 1} ---`);
      console.log(`Total líneas: ${pageLines.length}\n`);
      
      // Mostrar todas las líneas con índice
      pageLines.forEach((line, lineIndex) => {
        console.log(`${String(lineIndex).padStart(3)}: ${line}`);
      });
      
      console.log('\n');
    });
  } catch (error) {
    console.error('Error al leer el PDF:', error);
  }
}

testPDF();
