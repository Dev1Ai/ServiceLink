"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  children?: CategoryNode[];
};

export default function ProvidersCategoriesPage() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      setStatus("Loading...");
      try {
        const res = await fetch(`${API}/providers/categories`);
        const data = await res.json();
        if (Array.isArray(data)) setTree(data);
        setStatus(res.ok ? "OK" : `Error ${res.status}`);
      } catch {
        setStatus("Network error");
      }
    })();
  }, []);

  const render = (nodes: CategoryNode[], level = 0) => {
    return (
      <ul className={`list-none ${level ? "pl-16" : ""}`}>
        {nodes.map((n) => (
          <li key={n.id} className="my-6">
            <div className="flex gap-8 items-center">
              <span className={level === 0 ? "font-600" : ""}>{n.name}</span>
              <a
                href={`/providers/search?category=${encodeURIComponent(n.slug)}`}
              >
                Search
              </a>
              <a
                href={`/providers/near?category=${encodeURIComponent(n.slug)}`}
              >
                Near
              </a>
            </div>
            {n.children && n.children.length
              ? render(n.children, level + 1)
              : null}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="container">
      <h2>Provider Categories</h2>
      <div className="text-muted font-12 mb-8">{status}</div>
      {render(tree)}
      {!tree.length && status === "OK" && (
        <div className="text-muted">
          No categories found. Seed the database or add categories.
        </div>
      )}
    </div>
  );
}
