// `download` attribute is only honored by browsers for same-origin/blob/data URLs,
// so cross-origin file URLs (e.g. DO Spaces CDN) just navigate instead of downloading.
// Fetch as a blob and download that instead, falling back to a plain open if CORS blocks the fetch.
export const downloadFile = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download fetch failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
};
