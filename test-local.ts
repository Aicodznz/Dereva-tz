import fetch from 'node-fetch';

async function testMirrors() {
  const coords = "39.2326,-6.7721;39.2695,-6.8235";
  const mirrors = [
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
    `https://osrm.reit.link/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
    `http://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`
  ];

  for (const url of mirrors) {
    console.log(`Testing: ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      console.log(`- Status: ${res.status}`);
      if (res.ok) {
        const json: any = await res.json();
        console.log(`- Routes found: ${json.routes?.length}`);
      }
    } catch (err: any) {
      console.log(`- Failed: ${err.message}`);
    }
  }
}

testMirrors();
