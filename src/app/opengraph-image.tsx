import { ImageResponse } from "next/og"

export const alt = "GrandWealth — Wealth Management"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

function OgImage() {
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1a365d 100%)",
        fontFamily: "Inter, system-ui, sans-serif",
        position: "relative",
      }}
    >
      {/* Accent glow - top right */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 70%)",
        }}
      />

      {/* Accent glow - bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: -100,
          left: -60,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(52, 211, 153, 0.08) 0%, transparent 70%)",
        }}
      />

      {/* Logo icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 72,
          height: 72,
          borderRadius: 18,
          background: "linear-gradient(135deg, #38bdf8 0%, #2dd4bf 100%)",
          marginBottom: 24,
          boxShadow: "0 8px 32px rgba(56, 189, 248, 0.3)",
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
      </div>

      {/* Title */}
      <div
        style={{
          display: "flex",
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: "white",
          lineHeight: 1.1,
          textAlign: "center",
        }}
      >
        GrandWealth
      </div>

      {/* Subtitle */}
      <div
        style={{
          display: "flex",
          fontSize: 28,
          fontWeight: 400,
          color: "rgba(255, 255, 255, 0.65)",
          letterSpacing: "0.02em",
          marginTop: 8,
        }}
      >
        Wealth Management
      </div>

      {/* Divider */}
      <div
        style={{
          width: 60,
          height: 3,
          borderRadius: 2,
          background: "linear-gradient(90deg, #38bdf8, #2dd4bf)",
          marginTop: 28,
          marginBottom: 12,
        }}
      />

      {/* Tagline */}
      <div
        style={{
          display: "flex",
          fontSize: 18,
          fontWeight: 400,
          color: "rgba(255, 255, 255, 0.5)",
          letterSpacing: "0.01em",
        }}
      >
        Track expenses &bull; Manage budgets &bull; Grow investments
      </div>
    </div>
  )
}

export default async function Image() {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap",
    ).then((res) => res.text())

    const fontUrl = css.match(/src: url\(([^)]+)\)/)?.[1]

    if (fontUrl) {
      const fontData = await fetch(fontUrl).then((res) => res.arrayBuffer())

      return new ImageResponse(
        <OgImage />,
        {
          ...size,
          fonts: [
            {
              name: "Inter",
              data: fontData,
              style: "normal",
              weight: 400 as const,
            },
          ],
        },
      )
    }
  } catch {
    // Font loading failed — fall through to fallback below
  }

  // Fallback: render without custom font (uses system-ui)
  return new ImageResponse(
    <OgImage />,
    { ...size },
  )
}
