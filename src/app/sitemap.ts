import { MetadataRoute } from "next"
import { headers } from "next/headers"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers()
  const host = headersList.get("host") || "localhost:3000"
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http"
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`

  return [
    {
      url: `${baseUrl}/login`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/register`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/dashboard`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/transactions`,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/budgets`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/stocks`,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/gold`,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/savings`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/analysis`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/reports`,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/recurring`,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/settings`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ]
}
