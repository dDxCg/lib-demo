import neo4j from "neo4j-driver";
import { driver } from "@/service/neoDriver";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

interface Book {
  id: string;
  bookId: string;
  title: string;
}

interface Author {
  id: string;
  name: string;
}

interface Genre {
  id: string;
  name: string;
}

export async function GET(req: NextRequest) {
  const session = driver.session();
  try {
    const { searchParams } = new URL(req.url);

    const id = searchParams.get("id");
    const title = searchParams.get("title");
    const bookId = searchParams.get("bookId");
    const authors = searchParams.getAll("author"); // multiple possible
    const genres = searchParams.getAll("genre"); // multiple possible

    const conditions: string[] = [];
    const parameters: any = {};

    if (id) {
      conditions.push("id(b) = $id");
      parameters.id = neo4j.int(id);
    }
    if (title) {
      conditions.push("toLower(b.title) CONTAINS toLower($title)");
      parameters.title = title;
    }
    if (bookId) {
      conditions.push("b.bookId = $bookId");
      parameters.bookId = bookId;
    }
    if (authors.length > 0) {
      conditions.push(`
        EXISTS {
        MATCH (b)<-[:WROTE]-(a:Author)
        WHERE any(searchName IN $authors WHERE toLower(a.name) CONTAINS toLower(searchName))
        }
    `);
      parameters.authors = authors;
    }
    if (genres.length > 0) {
      conditions.push(`
        EXISTS {
        MATCH (b)-[:IN_GENRE]->(g:Genre)
        WHERE any(searchName IN $genres WHERE toLower(g.name) CONTAINS toLower(searchName))
        }
    `);
      parameters.genres = genres;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      MATCH (b:Book)
      ${whereClause}
      OPTIONAL MATCH (b)<-[:WROTE]-(a:Author)
      OPTIONAL MATCH (b)-[:IN_GENRE]->(g:Genre)
      RETURN b, collect(DISTINCT a) AS authors, collect(DISTINCT g) AS genres
    `;

    const result = await session.run(query, parameters);

    const data = result.records.map((r) => {
      const bookNode = r.get("b");
      const book = bookNode.properties;

      const authorNames = (r.get("authors") as any[])
        .filter((a) => a)
        .map((a) => a.properties.name);

      const genreNames = (r.get("genres") as any[])
        .filter((g) => g)
        .map((g) => g.properties.name);

      return {
        id: bookNode.identity.toString(),
        ...book,
        authors: authorNames,
        genres: genreNames,
      };
    });

    return NextResponse.json({ success: true, data: data });
  } catch (err) {
    console.error("GET Books ERROR: ", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}

export async function POST(req: NextRequest) {
  const session = driver.session();

  try {
    const body = await req.json();
    const { title, authors, genres } = body;

    if (!title) throw new Error("Book title missing");
    if (!authors || !Array.isArray(authors) || authors.length === 0) {
      throw new Error("At least one author required");
    }
    if (!genres || !Array.isArray(genres) || genres.length === 0) {
      throw new Error("At least one genre required");
    }

    const bookId = uuidv4();

    const query = `
        CREATE (b:Book { bookId: $bookId, title: $title })
        WITH b
        UNWIND $authors AS authorName
            MERGE (a:Author { name: authorName })
            MERGE (a)-[:WROTE]->(b)
        WITH b, collect(DISTINCT a) AS authors
        UNWIND $genres AS genreName
            MERGE (g:Genre { name: genreName })
            MERGE (b)-[:IN_GENRE]->(g)
        RETURN b, authors, collect(DISTINCT g) AS genres
    `;

    const params = { bookId, title, authors, genres };

    const result = await session.run(query, params);
    const record = result.records[0];
    const bookNode = record.get("b");

    return NextResponse.json({
      success: true,
      data: {
        id: bookNode.identity.toString(),
        ...bookNode.properties,
        authors: record.get("authors").map((a: any) => a.name),
        genres: record.get("genres").map((g: any) => g.name),
      },
    });
  } catch (err) {
    console.error("CREATE Books ERROR: ", err);
    return NextResponse.json({
      success: false,
      err,
    });
  } finally {
    await session.close();
  }
}

export async function PUT(req: NextRequest) {
  const session = driver.session();
  try {
    const url = new URL(req.url);
    const idParam = url.searchParams.get("id"); // Neo4j node id

    if (!idParam) {
      return NextResponse.json(
        { success: false, error: "Missing required id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { title, authors, genres } = body;

    if (!title) throw new Error("Book title missing");
    if (!authors || !Array.isArray(authors))
      throw new Error("Authors must be an array");
    if (!genres || !Array.isArray(genres))
      throw new Error("Genres must be an array");

    const query = `
      MATCH (b:Book)
      WHERE id(b) = $id
      SET b.title = $title

      WITH b
      OPTIONAL MATCH (b)<-[oldRel:WROTE]-(:Author)
      DELETE oldRel
      WITH b
      OPTIONAL MATCH (b)-[oldRel2:IN_GENRE]->(:Genre)
      DELETE oldRel2

      WITH b
      UNWIND $authors AS authorName
      MERGE (a:Author { name: authorName })
      MERGE (a)-[:WROTE]->(b)

      WITH b
      UNWIND $genres AS genreName
      MERGE (g:Genre { name: genreName })
      MERGE (b)-[:IN_GENRE]->(g)

      WITH b
      OPTIONAL MATCH (b)<-[:WROTE]-(a:Author)
      OPTIONAL MATCH (b)-[:IN_GENRE]->(g:Genre)
      RETURN b, collect(DISTINCT a.name) AS authors, collect(DISTINCT g.name) AS genres
    `;

    const params = { id: neo4j.int(idParam), title, authors, genres };
    const result = await session.run(query, params);

    if (result.records.length === 0) {
      return NextResponse.json(
        { success: false, error: "Book not found" },
        { status: 404 }
      );
    }

    const record = result.records[0];
    const bookNode = record.get("b");
    const book = bookNode.properties;
    const id = bookNode.identity.toString();

    return NextResponse.json({
      success: true,
      data: {
        id,
        ...book,
        authors: record.get("authors"),
        genres: record.get("genres"),
      },
    });
  } catch (err) {
    console.error("UPDATE Books Failed:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}

export async function DELETE(req: NextRequest) {
  const session = driver.session();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required id" },
        { status: 400 }
      );
    }

    const query = `
      MATCH (b: Book)
      WHERE id(b) = $id
      DETACH DELETE b
      RETURN count(b) AS deletedCount
    `;

    const result = await session.run(query, { id: neo4j.int(id) });

    const deletedCount = result.records[0].get("deletedCount").toNumber();

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (err) {
    console.error("DELETE Books ERROR: ", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  } finally {
    await session.close();
  }
}
