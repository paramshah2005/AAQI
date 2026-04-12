import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Lat and Lon are required' }, { status: 400 });
  }

  try {
    // We use the Wikipedia GeoSearch API as it is hyper-fast, never rate-limits like Overpass, and finds major nearby geographical suburbs/precincts.
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=10000&gscoord=${lat}|${lon}&gslimit=50&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Wiki API failed');
    
    const data = await res.json();
    
    // Filter out institutions, buildings, or broad districts
    const excludeKeywords = ['Institute', 'College', 'School', 'University', 'Center', 'Formula', 'District', 'Hospital', 'Memorial', 'Museum'];
    
    let fetchedSuburbs: string[] = [];
    if (data?.query?.geosearch) {
      fetchedSuburbs = data.query.geosearch
        .map((el: { title: string }) => el.title)
        .filter((title: string) => !excludeKeywords.some((kw: string) => title.toLowerCase().includes(kw.toLowerCase())));
    }
    
    const suburbs = fetchedSuburbs.length > 0 ? fetchedSuburbs : ['Current Location'];

    return NextResponse.json({ suburbs });
  } catch (error) {
    console.error('Failed to fetch suburbs:', error);
    return NextResponse.json({ suburbs: ['Current Location'] });
  }
}
