"use client";

import { useState, useEffect } from "react";

type Book = {
  id: string;
  bookId: string;
  title: string;
  authors: string[];
  genres: string[];
};

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [form, setForm] = useState({ title: "", authors: "", genres: "" });
  const [search, setSearch] = useState({ title: "", author: "", genre: "" });

  const fetchBooks = async (
    searchParams: Record<string, string | string[]> = {}
  ) => {
    const query = new URLSearchParams();
    for (const key in searchParams) {
      const value = searchParams[key];
      if (Array.isArray(value)) {
        value.forEach((v) => v && query.append(key, v));
      } else if (value) {
        query.append(key, value);
      }
    }
    const res = await fetch(`/api/books?${query.toString()}`);
    const data = await res.json();
    if (data.success) setBooks(data.data);
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title.trim(),
      authors: form.authors
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      genres: form.genres
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    if (editingBook) {
      await fetch(`/api/books?id=${editingBook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setForm({ title: "", authors: "", genres: "" });
    setEditingBook(null);
    fetchBooks();
  };

  const handleEdit = (book: Book) => {
    setEditingBook(book);
    setForm({
      title: book.title,
      authors: book.authors.join(", "),
      genres: book.genres.join(", "),
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this book?")) return;
    await fetch(`/api/books?id=${id}`, { method: "DELETE" });
    fetchBooks();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string | string[]> = {};
    if (search.title.trim()) params.title = search.title.trim();
    if (search.author.trim())
      params.author = search.author
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (search.genre.trim())
      params.genre = search.genre
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    fetchBooks(params);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center text-gray-900">
        📚 Books
      </h1>

      {/* Search Form */}
      <form
        onSubmit={handleSearch}
        className="mb-6 grid gap-4 md:grid-cols-4 bg-white p-5 rounded-xl shadow-md"
      >
        <input
          type="text"
          placeholder="Search Title"
          value={search.title}
          onChange={(e) => setSearch({ ...search, title: e.target.value })}
          className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-400 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Search Authors (comma separated)"
          value={search.author}
          onChange={(e) => setSearch({ ...search, author: e.target.value })}
          className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-400 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Search Genres (comma separated)"
          value={search.genre}
          onChange={(e) => setSearch({ ...search, genre: e.target.value })}
          className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-400 focus:outline-none"
        />
        <button
          type="submit"
          className="bg-green-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-green-600 transition-colors duration-200"
        >
          🔍 Search
        </button>
      </form>

      {/* Book Form */}
      <form
        onSubmit={handleSubmit}
        className="mb-8 grid gap-4 md:grid-cols-4 bg-white p-5 rounded-xl shadow-md"
      >
        <input
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
          required
        />
        <input
          type="text"
          placeholder="Authors (comma separated)"
          value={form.authors}
          onChange={(e) => setForm({ ...form, authors: e.target.value })}
          className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
          required
        />
        <input
          type="text"
          placeholder="Genres (comma separated)"
          value={form.genres}
          onChange={(e) => setForm({ ...form, genres: e.target.value })}
          className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
          required
        />
        <button
          type="submit"
          className="bg-blue-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors duration-200"
        >
          {editingBook ? "✏️ Update Book" : "➕ Add Book"}
        </button>
      </form>

      {/* Books Table */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-gray-300">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-r border-gray-300">
                Title
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-r border-gray-300">
                Authors
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-r border-gray-300">
                Genres
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {books.map((b, idx) => (
              <tr
                key={b.id}
                className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="px-6 py-4 text-sm text-gray-800 border-r border-gray-300">
                  {b.title}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 border-r border-gray-300">
                  {b.authors.join(", ")}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 border-r border-gray-300">
                  {b.genres.join(", ")}
                </td>
                <td className="px-6 py-4 flex justify-center gap-2">
                  <button
                    onClick={() => handleEdit(b)}
                    className="bg-yellow-400 px-3 py-1 rounded-lg hover:bg-yellow-500 transition-colors text-sm"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition-colors text-sm"
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
