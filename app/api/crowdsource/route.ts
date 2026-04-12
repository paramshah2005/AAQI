import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { areaName, lat, lon, category, sources } = body;

    if (!lat || !lon || !areaName || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const report = await prisma.aqiReport.create({
      data: {
        areaName,
        lat,
        lon,
        category,
        sources: JSON.stringify(sources || {}),
      },
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to record report';
    console.error('Failed to crowdsource data:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
