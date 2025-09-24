import { Redis } from '@upstash/redis'

// Initialize Redis client only if environment variables are available
let redis: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  } catch (error) {
    console.warn('Failed to initialize Redis client:', error)
  }
}

export interface CachedBlogPost {
  id: string
  title: string
  content: string
  author: string
  createdAt: string
  updatedAt: string
  published: boolean
  cachedAt: string
}

export class RedisCacheService {
  private static readonly CACHE_PREFIX = 'blog:'
  private static readonly POSTS_LIST_KEY = 'blog:posts:list'
  private static readonly CACHE_TTL = 420 // 5 minutes in seconds

  // Get all posts from cache
  async getAllPosts(): Promise<CachedBlogPost[] | null> {
    if (!redis) return null
    
    try {
      const cached = await redis.get<CachedBlogPost[]>(RedisCacheService.POSTS_LIST_KEY)
      if (!cached) return null
      
      // Check if cache has expired
      const now = new Date()
      const hasExpired = cached.some(post => {
        const cacheTime = new Date(post.cachedAt)
        const timeDiff = (now.getTime() - cacheTime.getTime()) / 1000 // seconds
        return timeDiff > RedisCacheService.CACHE_TTL
      })
      
      if (hasExpired) {
        console.log('Posts cache has expired, will fetch from GitHub')
        return null
      }
      
      return cached
    } catch (error) {
      console.error('Error fetching posts from Redis cache:', error)
      return null
    }
  }

  // Cache all posts
  async setAllPosts(posts: CachedBlogPost[]): Promise<void> {
    if (!redis) return
    
    try {
      const postsWithCacheTime = posts.map(post => ({
        ...post,
        cachedAt: new Date().toISOString()
      }))
      
      await redis.setex(
        RedisCacheService.POSTS_LIST_KEY,
        RedisCacheService.CACHE_TTL,
        postsWithCacheTime
      )
    } catch (error) {
      console.error('Error caching posts in Redis:', error)
    }
  }

  // Get single post from cache
  async getPost(id: string): Promise<CachedBlogPost | null> {
    if (!redis) return null
    
    try {
      const cached = await redis.get<CachedBlogPost>(`${RedisCacheService.CACHE_PREFIX}post:${id}`)
      if (!cached) return null
      
      // Check if cache has expired
      const now = new Date()
      const cacheTime = new Date(cached.cachedAt)
      const timeDiff = (now.getTime() - cacheTime.getTime()) / 1000 // seconds
      
      if (timeDiff > RedisCacheService.CACHE_TTL) {
        console.log(`Post ${id} cache has expired, will fetch from GitHub`)
        return null
      }
      
      return cached
    } catch (error) {
      console.error(`Error fetching post ${id} from Redis cache:`, error)
      return null
    }
  }

  // Cache single post
  async setPost(post: CachedBlogPost): Promise<void> {
    if (!redis) return
    
    try {
      const postWithCacheTime = {
        ...post,
        cachedAt: new Date().toISOString()
      }
      
      await redis.setex(
        `${RedisCacheService.CACHE_PREFIX}post:${post.id}`,
        RedisCacheService.CACHE_TTL,
        postWithCacheTime
      )
    } catch (error) {
      console.error(`Error caching post ${post.id} in Redis:`, error)
    }
  }

  // Invalidate post cache
  async invalidatePost(id: string): Promise<void> {
    if (!redis) return
    
    try {
      await redis.del(`${RedisCacheService.CACHE_PREFIX}post:${id}`)
    } catch (error) {
      console.error(`Error invalidating post ${id} cache:`, error)
    }
  }

  // Invalidate all posts cache
  async invalidateAllPosts(): Promise<void> {
    if (!redis) return
    
    try {
      await redis.del(RedisCacheService.POSTS_LIST_KEY)
    } catch (error) {
      console.error('Error invalidating all posts cache:', error)
    }
  }

  // Check if Redis is available
  async isAvailable(): Promise<boolean> {
    if (!redis) return false
    
    try {
      await redis.ping()
      return true
    } catch (error) {
      console.error('Redis is not available:', error)
      return false
    }
  }
}

export const redisCache = new RedisCacheService()
