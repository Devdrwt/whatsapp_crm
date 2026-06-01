import { ImageResponse } from "next/og";

// Drwintech favicon — an emerald rounded square with a white "D"
// monogram, matching the brand mark in src/components/layout/brand.tsx.
// Next.js renders this at build time and injects <link rel="icon">.

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Emerald → teal, matching the brand monogram gradient.
          backgroundImage: "linear-gradient(135deg, #10a87e 0%, #0ea5b5 100%)",
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "sans-serif",
          borderRadius: 7,
        }}
      >
        D
      </div>
    ),
    { ...size },
  );
}
