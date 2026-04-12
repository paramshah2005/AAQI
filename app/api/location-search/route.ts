import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Nominatim API usage policy: Must have a User-Agent, limit requests.
    // We limit to 5 results for efficiency.
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ApnaAQI-Dashboard/1.0 (https://github.com/ACM-Hackathon/AAQI_Temp)',
      },
    });

    if (!res.ok) {
      throw new Error('Location search API failed');
    }

    const data = await res.json();
    
    const results = data.map((item: { display_name: string; lat: string; lon: string; type: string; address: any }) => ({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      type: item.type,
      address: item.address
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Location search error:', error);
    return NextResponse.json({ error: 'Failed to search locations' }, { status: 500 });
  }
}
