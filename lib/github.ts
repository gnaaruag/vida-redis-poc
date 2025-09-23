import { Octokit } from "@octokit/rest"

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
})

const REPO_OWNER = process.env.GITHUB_REPO_OWNER!
const REPO_NAME = process.env.GITHUB_REPO_NAME!

export interface BlogPost {
  id: string
  title: string
  content: string
  author: string
  createdAt: string
  updatedAt: string
  published: boolean
}

export class GitHubService {
  private async getFileContent(path: string): Promise<string | null> {
    try {
      const { data } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path,
      })

      if ("content" in data) {
        return Buffer.from(data.content, "base64").toString("utf-8")
      }
      return null
    } catch (error) {
      console.error(`Error fetching file ${path}:`, error)
      return null
    }
  }

  private async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<boolean> {
    try {
      await octokit.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path,
        message,
        content: Buffer.from(content).toString("base64"),
        sha,
      })
      return true
    } catch (error) {
      console.error(`Error creating/updating file ${path}:`, error)
      return false
    }
  }

  async getAllPosts(): Promise<BlogPost[]> {
    try {
      const { data } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: "posts",
      })

      if (!Array.isArray(data)) {
        return []
      }

      const posts: BlogPost[] = []
      
      for (const file of data) {
        if (file.type === "file" && file.name.endsWith(".json")) {
          const content = await this.getFileContent(file.path)
          if (content) {
            try {
              const post = JSON.parse(content)
              posts.push(post)
            } catch (error) {
              console.error(`Error parsing post ${file.name}:`, error)
            }
          }
        }
      }

      return posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch (error) {
      console.error("Error fetching posts:", error)
      return []
    }
  }

  async getPost(id: string): Promise<BlogPost | null> {
    const content = await this.getFileContent(`posts/${id}.json`)
    if (!content) return null

    try {
      return JSON.parse(content)
    } catch (error) {
      console.error(`Error parsing post ${id}:`, error)
      return null
    }
  }

  async createPost(post: Omit<BlogPost, "id" | "createdAt" | "updatedAt">): Promise<BlogPost | null> {
    const id = Date.now().toString()
    const now = new Date().toISOString()
    
    const newPost: BlogPost = {
      ...post,
      id,
      createdAt: now,
      updatedAt: now,
    }

    const success = await this.createOrUpdateFile(
      `posts/${id}.json`,
      JSON.stringify(newPost, null, 2),
      `Create post: ${post.title}`
    )

    return success ? newPost : null
  }

  async updatePost(id: string, updates: Partial<Omit<BlogPost, "id" | "createdAt">>): Promise<BlogPost | null> {
    const existingPost = await this.getPost(id)
    if (!existingPost) return null

    const updatedPost: BlogPost = {
      ...existingPost,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    // Get the current file SHA
    let sha: string | undefined
    try {
      const { data } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: `posts/${id}.json`,
      })
      
      if ("sha" in data) {
        sha = data.sha
      }
    } catch (error) {
      console.error("Error getting file SHA:", error)
    }

    const success = await this.createOrUpdateFile(
      `posts/${id}.json`,
      JSON.stringify(updatedPost, null, 2),
      `Update post: ${updatedPost.title}`,
      sha
    )

    return success ? updatedPost : null
  }

  async deletePost(id: string): Promise<boolean> {
    try {
      // Get the current file SHA
      const { data } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: `posts/${id}.json`,
      })
      
      if (!("sha" in data)) {
        return false
      }

      await octokit.repos.deleteFile({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: `posts/${id}.json`,
        message: `Delete post: ${id}`,
        sha: data.sha,
      })

      return true
    } catch (error) {
      console.error(`Error deleting post ${id}:`, error)
      return false
    }
  }
}

export const githubService = new GitHubService()

