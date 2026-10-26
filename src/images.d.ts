/** An image import with `as=picture` (vite-imagetools): a srcset per format, and a fallback. */
declare module "*&as=picture" {
  const picture: {
    /** Format ("avif", "webp", "jpg") to its srcset. */
    sources: Record<string, string>
    img: { src: string; w: number; h: number }
  }
  export default picture
}
