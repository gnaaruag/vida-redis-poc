import { Octokit } from "@octokit/rest"
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs"
import { join } from "path"
import { redisCache, CachedBlogPost } from "./redis"

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
})

const REPO_OWNER = process.env.GITHUB_REPO_OWNER!
const REPO_NAME = process.env.GITHUB_REPO_NAME!
const DATA_DIR = process.env.DATA_DIR || "./data"
const POSTS_DIR = join(DATA_DIR, "posts")

// Ensure posts directory exists
if (!existsSync(POSTS_DIR)) {
  mkdirSync(POSTS_DIR, { recursive: true })
}

export interface BlogPost {
  id: string
  title: string
  content: string
  author: string
  createdAt: string
  updatedAt: string
  published: boolean
}

// Check if we're in development mode (no GitHub token or local development)
const isDevelopment = false

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
    sha?: string,
    author?: { name: string; email: string }
  ): Promise<boolean> {
    try {
      const commitData: Record<string, unknown> = {
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path,
        message,
        content: Buffer.from(content).toString("base64"),
        sha,
      }

      // Add author information if provided
      if (author) {
        commitData.author = {
          name: author.name,
          email: author.email,
        }
        commitData.committer = {
          name: author.name,
          email: author.email,
        }
      }

      await octokit.repos.createOrUpdateFileContents(commitData as {
        owner: string
        repo: string
        path: string
        message: string
        content: string
        sha?: string
        branch?: string
        committer?: { name: string; email: string }
        author?: { name: string; email: string }
      })
      return true
    } catch (error) {
      console.error(`Error creating/updating file ${path}:`, error)
      return false
    }
  }

  async getAllPosts(): Promise<BlogPost[]> {
    if (isDevelopment) {
      return this.getAllPostsLocal()
    }

    // Always check Redis first (Redis is primary source)
    const isRedisAvailable = await redisCache.isAvailable()
    if (isRedisAvailable) {
      const cachedPosts = await redisCache.getAllPosts()
      if (cachedPosts && cachedPosts.length > 0) {
        console.log('Serving posts from Redis cache')
        return cachedPosts.map(post => ({
          id: post.id,
          title: post.title,
          content: post.content,
          author: post.author,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          published: post.published
        }))
      }
    }

    // Redis cache miss or expired - fetch from GitHub (do NOT populate Redis)
    console.log('Redis cache miss/expired - fetching from GitHub')
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

      const sortedPosts = posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
      // Do NOT store in Redis when cache expires - only serve from GitHub
      console.log('Serving posts directly from GitHub (cache expired)')

      return sortedPosts
    } catch (error) {
      console.error("Error fetching posts from GitHub:", error)
      return []
    }
  }

  private getAllPostsLocal(): BlogPost[] {
    try {
      if (!existsSync(POSTS_DIR)) {
        return []
      }

      const files = readdirSync(POSTS_DIR)
      const posts: BlogPost[] = []

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const content = readFileSync(join(POSTS_DIR, file), "utf8")
            const post = JSON.parse(content)
            posts.push(post)
          } catch (error) {
            console.error(`Error parsing post ${file}:`, error)
          }
        }
      }

      return posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch (error) {
      console.error("Error fetching local posts:", error)
      return []
    }
  }

  async getPost(id: string): Promise<BlogPost | null> {
    if (isDevelopment) {
      return this.getPostLocal(id)
    }

    // Always check Redis first (Redis is primary source)
    const isRedisAvailable = await redisCache.isAvailable()
    if (isRedisAvailable) {
      const cachedPost = await redisCache.getPost(id)
      if (cachedPost) {
        console.log(`Serving post ${id} from Redis cache`)
        return {
          id: cachedPost.id,
          title: cachedPost.title,
          content: cachedPost.content,
          author: cachedPost.author,
          createdAt: cachedPost.createdAt,
          updatedAt: cachedPost.updatedAt,
          published: cachedPost.published
        }
      }
    }

    // Redis cache miss or expired - fetch from GitHub (do NOT populate Redis)
    console.log(`Redis cache miss/expired for post ${id} - fetching from GitHub`)
    const content = await this.getFileContent(`posts/${id}.json`)
    if (!content) return null

    try {
      const post = JSON.parse(content)
      
      // Do NOT store in Redis when cache expires - only serve from GitHub
      console.log(`Serving post ${id} directly from GitHub (cache expired)`)
      
      return post
    } catch (error) {
      console.error(`Error parsing post ${id}:`, error)
      return null
    }
  }

  private getPostLocal(id: string): BlogPost | null {
    try {
      const filePath = join(POSTS_DIR, `${id}.json`)
      if (!existsSync(filePath)) {
        return null
      }

      const content = readFileSync(filePath, "utf8")
      return JSON.parse(content)
    } catch (error) {
      console.error(`Error reading local post ${id}:`, error)
      return null
    }
  }

  async createPost(
    post: Omit<BlogPost, "id" | "createdAt" | "updatedAt">,
    author?: { name: string; email: string }
  ): Promise<BlogPost | null> {
    const id = Date.now().toString()
    const now = new Date().toISOString()
    
    const newPost: BlogPost = {
      ...post,
      id,
      createdAt: now,
      updatedAt: now,
    }

    if (isDevelopment) {
      return this.createPostLocal(newPost)
    }

    // Store in Redis first (Redis is primary source)
    const isRedisAvailable = await redisCache.isAvailable()
    if (isRedisAvailable) {
      const postToCache: CachedBlogPost = {
        ...newPost,
        cachedAt: new Date().toISOString()
      }
      await redisCache.setPost(postToCache)
      console.log(`Stored new post ${id} in Redis`)
    }

    // Then store in GitHub
    const commitMessage = author 
      ? `Create post: ${post.title} (by ${author.name} <${author.email}>)`
      : `Create post: ${post.title}`

    const success = await this.createOrUpdateFile(
      `posts/${id}.json`,
      JSON.stringify(newPost, null, 2),
      commitMessage,
      undefined,
      author
    )

    if (success) {
      // Update the posts list cache
      if (isRedisAvailable) {
        await redisCache.invalidateAllPosts()
        console.log(`Updated posts list cache for new post ${id}`)
      }
    } else {
      // If GitHub failed, remove from Redis
      if (isRedisAvailable) {
        await redisCache.invalidatePost(id)
        console.log(`Removed post ${id} from Redis due to GitHub failure`)
      }
    }

    return success ? newPost : null
  }

  private createPostLocal(post: BlogPost): BlogPost | null {
    try {
      const filePath = join(POSTS_DIR, `${post.id}.json`)
      writeFileSync(filePath, JSON.stringify(post, null, 2))
      return post
    } catch (error) {
      console.error(`Error creating local post ${post.id}:`, error)
      return null
    }
  }

  async updatePost(
    id: string, 
    updates: Partial<Omit<BlogPost, "id" | "createdAt">>,
    author?: { name: string; email: string }
  ): Promise<BlogPost | null> {
    const existingPost = await this.getPost(id)
    if (!existingPost) return null

    const updatedPost: BlogPost = {
      ...existingPost,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    if (isDevelopment) {
      return this.updatePostLocal(updatedPost)
    }

    // Update Redis first (Redis is primary source)
    const isRedisAvailable = await redisCache.isAvailable()
    if (isRedisAvailable) {
      const postToCache: CachedBlogPost = {
        ...updatedPost,
        cachedAt: new Date().toISOString()
      }
      await redisCache.setPost(postToCache)
      console.log(`Updated post ${id} in Redis`)
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

    const commitMessage = author 
      ? `Update post: ${updatedPost.title} (by ${author.name} <${author.email}>)`
      : `Update post: ${updatedPost.title}`

    const success = await this.createOrUpdateFile(
      `posts/${id}.json`,
      JSON.stringify(updatedPost, null, 2),
      commitMessage,
      sha,
      author
    )

    if (success) {
      // Update the posts list cache
      if (isRedisAvailable) {
        await redisCache.invalidateAllPosts()
        console.log(`Updated posts list cache for post ${id}`)
      }
    } else {
      // If GitHub failed, revert Redis to original post
      if (isRedisAvailable) {
        const originalPost: CachedBlogPost = {
          ...existingPost,
          cachedAt: new Date().toISOString()
        }
        await redisCache.setPost(originalPost)
        console.log(`Reverted post ${id} in Redis due to GitHub failure`)
      }
    }

    return success ? updatedPost : null
  }

  private updatePostLocal(post: BlogPost): BlogPost | null {
    try {
      const filePath = join(POSTS_DIR, `${post.id}.json`)
      writeFileSync(filePath, JSON.stringify(post, null, 2))
      return post
    } catch (error) {
      console.error(`Error updating local post ${post.id}:`, error)
      return null
    }
  }

  async deletePost(id: string, author?: { name: string; email: string }): Promise<boolean> {
    if (isDevelopment) {
      return this.deletePostLocal(id)
    }

    // Remove from Redis first (Redis is primary source)
    const isRedisAvailable = await redisCache.isAvailable()
    if (isRedisAvailable) {
      await redisCache.invalidatePost(id)
      console.log(`Removed post ${id} from Redis`)
    }

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

      const commitMessage = author 
        ? `Delete post: ${id} (by ${author.name} <${author.email}>)`
        : `Delete post: ${id}`

      const deleteData: Record<string, unknown> = {
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: `posts/${id}.json`,
        message: commitMessage,
        sha: data.sha,
      }

      // Add author information if provided
      if (author) {
        deleteData.author = {
          name: author.name,
          email: author.email,
        }
        deleteData.committer = {
          name: author.name,
          email: author.email,
        }
      }

      await octokit.repos.deleteFile(deleteData as {
        owner: string
        repo: string
        path: string
        message: string
        sha: string
        branch?: string
        committer?: { name: string; email: string }
        author?: { name: string; email: string }
      })

      // Update the posts list cache
      if (isRedisAvailable) {
        await redisCache.invalidateAllPosts()
        console.log(`Updated posts list cache after deleting post ${id}`)
      }

      return true
    } catch (error) {
      console.error(`Error deleting post ${id}:`, error)
      return false
    }
  }

  private deletePostLocal(id: string): boolean {
    try {
      const filePath = join(POSTS_DIR, `${id}.json`)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
        return true
      }
      return false
    } catch (error) {
      console.error(`Error deleting local post ${id}:`, error)
      return false
    }
  }
}

export const githubService = new GitHubService()

