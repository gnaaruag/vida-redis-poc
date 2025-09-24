import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { githubService } from "@/lib/github"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const post = await githubService.getPost(id)
    
    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(post)
  } catch (error) {
    console.error("Error fetching post:", error)
    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    const { title, content, published } = await request.json()

    const updates: Partial<{ title: string; content: string; published: boolean }> = {}
    if (title !== undefined) updates.title = title
    if (content !== undefined) updates.content = content
    if (published !== undefined) updates.published = published

    const authorInfo = {
      name: session.user?.name || session.user?.email || 'Unknown User',
      email: session.user?.email || 'unknown@example.com'
    }

    const post = await githubService.updatePost(id, updates, authorInfo)

    if (!post) {
      return NextResponse.json(
        { error: "Post not found or failed to update" },
        { status: 404 }
      )
    }

    return NextResponse.json(post)
  } catch (error) {
    console.error("Error updating post:", error)
    return NextResponse.json(
      { error: "Failed to update post" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    
    const authorInfo = {
      name: session.user?.name || session.user?.email || 'Unknown User',
      email: session.user?.email || 'unknown@example.com'
    }

    const success = await githubService.deletePost(id, authorInfo)

    if (!success) {
      return NextResponse.json(
        { error: "Post not found or failed to delete" },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: "Post deleted successfully" })
  } catch (error) {
    console.error("Error deleting post:", error)
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    )
  }
}

