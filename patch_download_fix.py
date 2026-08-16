import re

with open('src/components/VendorDashboard.tsx', 'r') as f:
    content = f.read()

# 1. Fix handleDownloadStand
old_download_func = """  const handleDownloadStand = async () => {
    const el = document.getElementById('printable-stand');
    if (!el || isExporting) return;
    
    setIsExporting(true);
    const toastId = toast.loading('Inatengeneza picha ya Stand...', {
      style: { background: '#000', color: '#fff' }
    });
    try {
      // Small delay to ensure styles are applied
      await new Promise(r => setTimeout(r, 500));
      
      let dataUrl;
      try {
        dataUrl = await toPng(el, { 
          quality: 0.95, 
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
          skipFonts: true,
          imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        });
      } catch (firstErr) {
        console.warn('First export attempt failed, trying robust fallback options...', firstErr);
        // Fallback with lower pixel ratio and disabled cacheBust for high-compatibility
        dataUrl = await toPng(el, {
          quality: 0.9,
          pixelRatio: 1.5,
          backgroundColor: '#ffffff',
          cacheBust: false,
          skipFonts: true,
          imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        });
      }
      
      const link = document.createElement('a');
      link.download = `QR-Stand-${selectedSection?.number || 'Vendor'}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Stand imepakuliwa kwa mafanikio!', { id: toastId });
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Imeshindwa kupakua stand. Hakikisha picha zako zote zimewekwa vizuri au tumia kitufe cha Chapa.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };"""

new_download_func = """  const handleDownloadStand = async () => {
    const el = document.getElementById('printable-stand');
    if (!el || isExporting) return;
    
    setIsExporting(true);
    const toastId = toast.loading('Inatengeneza Bango lenye Ubora wa Juu (HD)...', {
      style: { background: '#000', color: '#fff' }
    });
    try {
      // Ensure all internal images are ready
      const imgElements = Array.from(el.querySelectorAll('img'));
      await Promise.all(
        imgElements.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 1500);
          });
        })
      );

      // Delay to let browser render all fonts and SVG/canvas QR codes
      await new Promise(r => setTimeout(r, 600));
      
      let dataUrl;
      try {
        dataUrl = await toPng(el, { 
          quality: 1, 
          pixelRatio: 3, // Ultra-sharp print resolution
          cacheBust: true,
          skipFonts: false,
          imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        });
      } catch (firstErr) {
        console.warn('First export attempt failed, trying fallback mode...', firstErr);
        dataUrl = await toPng(el, {
          quality: 0.98,
          pixelRatio: 2,
          cacheBust: false,
          skipFonts: true,
          imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        });
      }
      
      const link = document.createElement('a');
      link.download = `Bango-Stand-${(vendorProfile?.businessName || 'Mgahawa').replace(/[^a-zA-Z0-9]/g, '_')}-Meza-${selectedSection?.number || '21'}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Bango / Stand imepakuliwa kikamilifu (HD Quality)!', { id: toastId });
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Imeshindwa kupakua bango. Unaweza pia kubofya Chapa (Print) au kujaribu tena.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };"""

if old_download_func in content:
    content = content.replace(old_download_func, new_download_func)
    print("Replaced handleDownloadStand successfully!")
else:
    print("Direct string match for handleDownloadStand not found, doing regex replacement...")
    content = re.sub(
        r'const handleDownloadStand = async \(\) => \{[\s\S]*?finally \{\s*setIsExporting\(false\);\s*\}\s*\};',
        new_download_func.strip(),
        content
    )
    print("Replaced handleDownloadStand via regex!")

# 2. Fix Wi-Fi text wrapping and image loading in printable-stand
content = content.replace(
    '<span className="text-[7px] font-black uppercase tracking-wider block" style={{ color: goldTextColor }}>GUEST WI-FI</span>',
    '<span className="text-[7.5px] font-black uppercase tracking-wider block whitespace-nowrap" style={{ color: goldTextColor }}>GUEST WI-FI</span>'
)

# 3. Ensure logo image in crest has crossOrigin="anonymous" and getProxiedImageUrl
content = content.replace(
    'src={goldLogoUrl || vendorProfile?.logoUrl || \'\'}',
    'src={getProxiedImageUrl(goldLogoUrl || vendorProfile?.logoUrl || \'\')}'
)

with open('src/components/VendorDashboard.tsx', 'w') as f:
    f.write(content)

print("Fixes applied!")
