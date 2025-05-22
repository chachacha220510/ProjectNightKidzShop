import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"

export async function GET(request: NextRequest) {
  const tags = request.nextUrl.searchParams.get("tag")?.split(",") || [];
  
  if (!tags.length) {
    return NextResponse.json({ message: "Missing tag parameter" }, { status: 400 })
  }

  // Revalidate all specified cache tags
  const revalidatedTags = [];
  for (const tag of tags) {
    try {
      revalidateTag(tag.trim());
      revalidatedTags.push(tag.trim());
    } catch (error) {
      console.error(`Error revalidating tag ${tag}:`, error);
    }
  }
  
  return NextResponse.json({ 
    revalidated: true, 
    now: Date.now(),
    tags: revalidatedTags
  })
} 