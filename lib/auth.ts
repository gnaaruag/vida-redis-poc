import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

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

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
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
        const user = users.find(u => u.email === credentials.email)

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password || "")
        
        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      }
    })
  ],
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
  },
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        session.user.id = token.id as string
      }
      return session
    }
  },
  session: {
    strategy: "jwt"
  }
}

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
