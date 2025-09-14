import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://servicelink.example';
  const lastModified = new Date();
  return [
    { url: `${base}/`, lastModified },
    { url: `${base}/about`, lastModified },
    { url: `${base}/privacy`, lastModified },
  ];
}

