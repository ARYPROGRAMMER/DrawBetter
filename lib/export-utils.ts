import { Layer } from "@/types/canvas";

export type ExportFormat = "svg" | "png" | "jpg" | "pdf";
export type ExportQuality = "low" | "medium" | "high" | "ultra";
export type ExportTheme = "light" | "dark" | "transparent";


function sanitizeFilename(filename: string): string {
  return filename
    .trim()
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/-{2,}/g, '-')
    .slice(0, 100)
    || 'drawing';
}


function convertOklchToRgb(colorString: string): string {
  const oklchMap: { [key: string]: string } = {
    'oklch(0.962 0.013 106.47)': '#f8fafc',
    'oklch(0.902 0.029 106.423)': '#e2e8f0',
    'oklch(0.278 0.029 256.848)': '#334155',
    'oklch(0.152 0.017 267.218)': '#0f172a',
    'oklch(0.026 0.014 285.82)': '#020617',
    'oklch(0.998 0.001 106.49)': '#ffffff',
    'oklch(0 0 0)': '#000000',
  };
  
  return oklchMap[colorString] || '#000000';
}


function cleanSVGForExport(svgString: string): string {
  let cleanedSvg = svgString;
  
  cleanedSvg = cleanedSvg.replace(/oklch\([^)]+\)/g, (match) => {
    const converted = convertOklchToRgb(match);
    console.log(`🎨 Converted ${match} to ${converted}`);
    return converted;
  });
  
  if (!cleanedSvg.includes('@import') && cleanedSvg.includes('Kalam')) {
    cleanedSvg = cleanedSvg.replace(
      /<style>/,
      `<style>@import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap');`
    );
  }
  
  return cleanedSvg;
}

async function getCleanSVGString(theme: ExportTheme = 'light'): Promise<string> {
  const canvasSVG = document.querySelector('svg.h-\\[100vh\\]') as SVGElement;
  if (!canvasSVG) {
    throw new Error('Canvas SVG not found');
  }

  const transformGroup = canvasSVG.querySelector('g[style*="transform"]') as SVGGElement;
  if (!transformGroup) {
    throw new Error('Canvas transform group not found. Make sure you have drawings on the canvas.');
  }

  const layerElements = Array.from(transformGroup.children).filter(child => {
    const tagName = child.tagName.toLowerCase();
    return ['rect', 'ellipse', 'path', 'foreignobject'].includes(tagName);
  });

  if (layerElements.length === 0) {
    throw new Error('No drawing layers found in the canvas.');
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const element of layerElements) {
    const style = element.getAttribute('style') || '';
    const transformMatch = style.match(/transform:\s*translate\(([^)]+)\)/);
    
    if (transformMatch) {
      const [translateX, translateY] = transformMatch[1].split(',').map(val => 
        parseFloat(val.replace('px', '').trim())
      );
      
      let width = 0, height = 0;
      const tagName = element.tagName.toLowerCase();
      
      if (tagName === 'ellipse') {
        const rx = parseFloat(element.getAttribute('rx') || '0');
        const ry = parseFloat(element.getAttribute('ry') || '0');
        width = rx * 2;
        height = ry * 2;
      } else if (tagName === 'rect') {
        width = parseFloat(element.getAttribute('width') || '0');
        height = parseFloat(element.getAttribute('height') || '0');
      } else if (tagName === 'foreignobject') {
        width = parseFloat(element.getAttribute('width') || '0');
        height = parseFloat(element.getAttribute('height') || '0');
      } else if (tagName === 'path') {
        try {
          const pathElement = element as SVGPathElement;
          const bbox = pathElement.getBBox();
          width = bbox.width;
          height = bbox.height;
        } catch {
          width = 200;
          height = 200;
        }
      }
      
      minX = Math.min(minX, translateX);
      minY = Math.min(minY, translateY);
      maxX = Math.max(maxX, translateX + width);
      maxY = Math.max(maxY, translateY + height);
    }
  }

  const padding = 0; 
  const scale = 1; 
  const scaledWidth = (maxX - minX) * scale;
  const scaledHeight = (maxY - minY) * scale;
  const exportWidth = Math.ceil(scaledWidth + padding * 2);
  const exportHeight = Math.ceil(scaledHeight + padding * 2);
  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;

  const exportSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  exportSVG.setAttribute('width', exportWidth.toString());
  exportSVG.setAttribute('height', exportHeight.toString());
  exportSVG.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${exportWidth} ${exportHeight}`);
  exportSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap');
    
    .drop-shadow-md {
      filter: drop-shadow(0 4px 3px rgb(0 0 0 / 0.07)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.06));
    }
    
    .drop-shadow-xl {
      filter: drop-shadow(0 20px 13px rgb(0 0 0 / 0.03)) drop-shadow(0 8px 5px rgb(0 0 0 / 0.08));
    }
    
    .shadow-md {
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    }
    
    .text-element {
      font-family: 'Kalam', cursive;
      font-weight: 400;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      outline: none;
    }
  `;
  defs.appendChild(style);
  exportSVG.appendChild(defs);

  if (theme !== 'transparent') {
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('x', viewBoxX.toString());
    background.setAttribute('y', viewBoxY.toString());
    background.setAttribute('width', exportWidth.toString());
    background.setAttribute('height', exportHeight.toString());
    background.setAttribute('fill', theme === 'light' ? 'white' : '#1a1a1a');
    exportSVG.appendChild(background);
  }

  const scaledGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  scaledGroup.setAttribute('transform', `translate(${centerX}, ${centerY}) scale(${scale}) translate(${-centerX}, ${-centerY})`);

  for (const element of layerElements) {
    const clonedElement = element.cloneNode(true) as SVGElement;
    
    clonedElement.removeAttribute('stroke');
    if (clonedElement.getAttribute('stroke') === 'transparent') {
      clonedElement.setAttribute('stroke', 'transparent');
    }
    
    if (clonedElement.tagName.toLowerCase() === 'foreignobject') {
      const divElement = clonedElement.querySelector('div');
      if (divElement) {
        divElement.classList.add('text-element');
        divElement.style.fontFamily = 'Kalam, cursive';
      }
    }
    
    scaledGroup.appendChild(clonedElement);
  }

  exportSVG.appendChild(scaledGroup);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(exportSVG);
  
  return cleanSVGForExport(svgString);
}

async function convertSVGToFormat(svgString: string, format: 'png' | 'jpg' | 'pdf', quality: number = 0.95, theme: ExportTheme = 'light', filename: string = 'drawing'): Promise<void> {
  if (format === 'pdf') {
    await convertSVGToPDF(svgString, theme, quality, filename);
    return;
  }
  
  return new Promise((resolve, reject) => {
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        const getScaleFactor = (format: string, quality: number): number => {
          if (format !== 'png') return 1;
          
          if (quality <= 0.6) return 1;
          if (quality <= 0.8) return 1.5;
          if (quality <= 0.95) return 2;
          return 3;
        };
        
        const scaleFactor = getScaleFactor(format, quality);
        
        const baseWidth = img.naturalWidth || img.width;
        const baseHeight = img.naturalHeight || img.height;
        canvas.width = Math.floor(baseWidth * scaleFactor);
        canvas.height = Math.floor(baseHeight * scaleFactor);
        
        if (format === 'jpg' || (theme === 'light' && format !== 'png')) {
          ctx.fillStyle = theme === 'light' ? '#ffffff' : '#1a1a1a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        if (scaleFactor !== 1) {
          ctx.scale(scaleFactor, scaleFactor);
        }
        
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to convert canvas to blob'));
            return;
          }
          
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${sanitizeFilename(filename)}.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          URL.revokeObjectURL(url);
          resolve();
        }, format === 'jpg' ? 'image/jpeg' : 'image/png', quality);
        
      } catch (error) {
        console.error('Canvas conversion error:', error);
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      console.error('SVG image load error:', error);
      reject(new Error('Failed to load SVG as image'));
    };
    
    img.crossOrigin = 'anonymous';
    img.src = svgDataUrl;
  });
}

// Export functions using the shared SVG generation

// Improved PDF conversion using jsPDF and direct canvas approach
async function convertSVGToPDF(svgString: string, theme: ExportTheme = 'light', quality: number = 0.95, filename: string = 'drawing'): Promise<void> {
  try {
    console.log('🔄 Starting PDF conversion...');
    
    const { jsPDF } = await import('jspdf');
    
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = async () => {
        try {
          const tempCanvas = document.createElement('canvas');
          const ctx = tempCanvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          const getScaleFactor = (quality: number): number => {
            if (quality <= 0.6) return 1;      
            if (quality <= 0.8) return 1.5;    
            if (quality <= 0.95) return 2;    
            return 2.5;                        
          };
          
          const scaleFactor = getScaleFactor(quality);
          
          const baseWidth = img.naturalWidth || img.width;
          const baseHeight = img.naturalHeight || img.height;
          tempCanvas.width = Math.floor(baseWidth * scaleFactor);
          tempCanvas.height = Math.floor(baseHeight * scaleFactor);
          
          ctx.fillStyle = theme === 'light' ? '#ffffff' : '#1a1a1a';
          ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          
          ctx.scale(scaleFactor, scaleFactor);
          
          ctx.drawImage(img, 0, 0);
          
          const imgWidth = baseWidth;
          const imgHeight = baseHeight;
          
          const aspectRatio = imgWidth / imgHeight;
          const a4Width = 210; 
          const a4Height = 297; 
          
          let pdfWidth, pdfHeight;
          
          if (aspectRatio > a4Width / a4Height) {
            pdfWidth = a4Width;
            pdfHeight = a4Width / aspectRatio;
          } else {
            pdfHeight = a4Height;
            pdfWidth = a4Height * aspectRatio;
          }
          
          const pdf = new jsPDF({
            orientation: aspectRatio > 1 ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pdfWidth, pdfHeight]
          });
          
          const imgData = tempCanvas.toDataURL('image/png', quality);
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          
          pdf.save(`${sanitizeFilename(filename)}.pdf`);
          
          console.log('✅ PDF conversion successful');
          resolve();
          
        } catch (error) {
          console.error('PDF canvas conversion failed:', error);
          reject(error);
        }
      };
      
      img.onerror = (error) => {
        console.error('SVG image load failed:', error);
        reject(new Error('Failed to load SVG as image for PDF conversion'));
      };
      
      img.crossOrigin = 'anonymous';
      img.src = svgDataUrl;
    });
    
  } catch (error) {
    console.error('PDF conversion failed:', error);
    throw new Error(`PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Export functions using the shared SVG generation

// SVG Export - uses the shared SVG generation
export async function exportCanvasSVG(theme: ExportTheme = 'light', filename: string = 'drawing'): Promise<void> {
  try {
    console.log('🎯 Starting SVG export...');
    
    const cleanedSvgString = await getCleanSVGString(theme);
    
    const blob = new Blob([cleanedSvgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFilename(filename)}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log('✅ SVG export successful');
  } catch (error) {
    console.error('❌ SVG export failed:', error);
    throw error;
  }
}

// PNG Export - uses the shared SVG as source
export async function exportCanvasPNG(quality: ExportQuality = 'high', theme: ExportTheme = 'light', filename: string = 'drawing'): Promise<void> {
  try {
    console.log('🎯 Starting PNG export...');
    
    const svgString = await getCleanSVGString(theme);
    
    const qualityValue = getQualityValue(quality);
    
    await convertSVGToFormat(svgString, 'png', qualityValue, theme, filename);
    
    console.log('✅ PNG export successful');
  } catch (error) {
    console.error('❌ PNG export failed:', error);
    throw error;
  }
}

// JPG Export - uses the shared SVG as source
export async function exportCanvasJPG(quality: ExportQuality = 'high', theme: ExportTheme = 'light', filename: string = 'drawing'): Promise<void> {
  try {
    console.log('🎯 Starting JPG export...');
    
    const svgString = await getCleanSVGString(theme);
    
    const qualityValue = getQualityValue(quality);
    
    await convertSVGToFormat(svgString, 'jpg', qualityValue, theme, filename);
    
    console.log('✅ JPG export successful');
  } catch (error) {
    console.error('❌ JPG export failed:', error);
    throw error;
  }
}

// PDF Export - uses the shared SVG as source
export async function exportCanvasPDF(quality: ExportQuality = 'high', theme: ExportTheme = 'light', filename: string = 'drawing'): Promise<void> {
  try {
    console.log('🎯 Starting PDF export...');
    
    const svgString = await getCleanSVGString(theme);
    
    const qualityValue = getQualityValue(quality);
    
    await convertSVGToFormat(svgString, 'pdf', qualityValue, theme, filename);
    
    console.log('✅ PDF export successful');
  } catch (error) {
    console.error('❌ PDF export failed:', error);
    throw error;
  }
}

// Helper function to convert quality enum to number
function getQualityValue(quality: ExportQuality): number {
  switch (quality) {
    case 'low': return 0.6;
    case 'medium': return 0.8;
    case 'high': return 0.95;
    case 'ultra': return 1.0;
    default: return 0.95;
  }
}

// Export selected elements only
export async function exportSelectedElements(
  selectedLayers: Layer[], 
  format: 'svg' | 'png' | 'jpg' | 'pdf', 
  camera: { x: number; y: number; zoom: number },
  quality: ExportQuality = 'high', 
  theme: ExportTheme = 'light', 
  filename: string = 'selection'
): Promise<void> {
  try {
    console.log('🎯 Starting selected elements export...');
    
    if (!selectedLayers || selectedLayers.length === 0) {
      throw new Error('No elements selected for export');
    }

    // Find the corresponding DOM elements for selected layers
    const canvasSVG = document.querySelector('svg.h-\\[100vh\\]') as SVGElement;
    if (!canvasSVG) {
      throw new Error('Canvas SVG not found');
    }

    const transformGroup = canvasSVG.querySelector('g[style*="transform"]') as SVGGElement;
    if (!transformGroup) {
      throw new Error('Canvas transform group not found');
    }

    // Get all layer elements and find bounds of selected layers
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const selectedElements: Element[] = [];

    // Calculate bounds of selected layers
    for (const layer of selectedLayers) {
      minX = Math.min(minX, layer.x);
      minY = Math.min(minY, layer.y);
      maxX = Math.max(maxX, layer.x + layer.width);
      maxY = Math.max(maxY, layer.y + layer.height);
    }

    // Find corresponding DOM elements by checking their positions
    const allLayerElements = Array.from(transformGroup.children).filter(child => {
      const tagName = child.tagName.toLowerCase();
      return ['rect', 'ellipse', 'path', 'foreignobject'].includes(tagName);
    });

    for (const element of allLayerElements) {
      const style = element.getAttribute('style') || '';
      const transformMatch = style.match(/transform:\s*translate\(([^)]+)\)/);
      
      if (transformMatch) {
        const [translateX, translateY] = transformMatch[1].split(',').map(val => 
          parseFloat(val.replace('px', '').trim())
        );
        
        // Check if this element corresponds to any selected layer
        const matchingLayer = selectedLayers.find(layer => 
          Math.abs(layer.x - translateX) < 1 && Math.abs(layer.y - translateY) < 1
        );
        
        if (matchingLayer) {
          selectedElements.push(element);
        }
      }
    }

    if (selectedElements.length === 0) {
      throw new Error('Could not find DOM elements for selected layers');
    }

    // Create export SVG for selected elements only
    const padding = 20;
    const exportWidth = Math.ceil(maxX - minX + padding * 2);
    const exportHeight = Math.ceil(maxY - minY + padding * 2);
    const viewBoxX = minX - padding;
    const viewBoxY = minY - padding;

    const exportSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    exportSVG.setAttribute('width', exportWidth.toString());
    exportSVG.setAttribute('height', exportHeight.toString());
    exportSVG.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${exportWidth} ${exportHeight}`);
    exportSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Add styles
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap');
      .text-element {
        font-family: 'Kalam', cursive;
        font-weight: 400;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        outline: none;
      }
    `;
    defs.appendChild(style);
    exportSVG.appendChild(defs);

    // Add background if not transparent
    if (theme !== 'transparent') {
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('x', viewBoxX.toString());
      background.setAttribute('y', viewBoxY.toString());
      background.setAttribute('width', exportWidth.toString());
      background.setAttribute('height', exportHeight.toString());
      background.setAttribute('fill', theme === 'light' ? 'white' : '#1a1a1a');
      exportSVG.appendChild(background);
    }

    // Clone and add selected elements
    for (const element of selectedElements) {
      const clonedElement = element.cloneNode(true) as SVGElement;
      
      if (clonedElement.tagName.toLowerCase() === 'foreignobject') {
        const divElement = clonedElement.querySelector('div');
        if (divElement) {
          divElement.classList.add('text-element');
          divElement.style.fontFamily = 'Kalam, cursive';
        }
      }
      
      exportSVG.appendChild(clonedElement);
    }

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(exportSVG);
    svgString = cleanSVGForExport(svgString);

    // Export based on format
    if (format === 'svg') {
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeFilename(filename)}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const qualityValue = getQualityValue(quality);
      await convertSVGToFormat(svgString, format, qualityValue, theme, filename);
    }
    
    console.log('✅ Selected elements export successful');
  } catch (error) {
    console.error('❌ Selected elements export failed:', error);
    throw error;
  }
}