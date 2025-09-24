import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

interface JWTToken {
  id?: string
  [key: string]: unknown
}

interface SessionUser {
  id?: string
  name?: string | null
  email?: string | null
  [key: string]: unknown
}

const DATA_DIR = process.env.DATA_DIR || "./data"
const USERS_FILE = join(DATA_DIR, "users.json")

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// Initialize users file if it doesn't exist
if (!existsSync(USERS_FILE)) {
  writeFileSync(USERS_FILE, JSON.stringify([], null, 2))
}

interface User {
  id: string
  email: string
  password: string
  name: string
  createdAt: string
}

// Type guard to ensure user has required properties
function isValidUser(user: unknown): user is User {
  if (!user || typeof user !== 'object') return false
  
  const obj = user as Record<string, unknown>
  return typeof obj.id === 'string' && 
         typeof obj.email === 'string' && 
         typeof obj.password === 'string' && 
         typeof obj.name === 'string' && 
         typeof obj.createdAt === 'string'
}

function getUsers(): User[] {
  try {
    const data = readFileSync(USERS_FILE, "utf8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

function saveUsers(users: User[]) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const users = getUsers()
        const foundUser = users.find(u => u.email === credentials.email)

        if (!foundUser) {
          return null
        }

        // Direct access to password with type assertion
        const userObj = foundUser as unknown as { password: string }
        const passwordHash: string = userObj.password
        const isPasswordValid = await bcrypt.compare(credentials.password as string, passwordHash as string)
        
        if (!isPasswordValid) {
          return null
        }

        return {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
        }
      }
    })
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }: { token: JWTToken; user: unknown }) {
      if (user && typeof user === 'object' && user !== null && 'id' in user) {
        token.id = (user as { id: string }).id
      }
      return token
    },
    async session({ session, token }: { session: any; token: JWTToken }) {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    }
  },
  session: {
    strategy: "jwt"
  }
})

// Helper function to create a new user
export async function createUser(email: string, password: string, name: string) {
  const users = getUsers()
  
  // Check if user already exists
  if (users.find(u => u.email === email)) {
    throw new Error("User already exists")
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const newUser: User = {
    id: Date.now().toString(),
    email,
    password: hashedPassword,
    name,
    createdAt: new Date().toISOString()
  }

  users.push(newUser)
  saveUsers(users)
  
  return newUser
}
