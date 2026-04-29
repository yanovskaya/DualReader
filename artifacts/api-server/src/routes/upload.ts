import { Router } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { db } from "@workspace/db";
import { booksTable, paragraphsTable } from "@workspace/db";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function extractTextFromHtml(html: string): string {
  // Remove script and style blocks
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Replace block elements with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|br|tr|blockquote)>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode HTML entities
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  return text;
}

function parseEpub(buffer: Buffer): { title: string; content: string } {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  // Try to get title from OPF metadata
  let title = "Untitled";
  const opfEntry = entries.find(e => e.entryName.endsWith(".opf"));
  if (opfEntry) {
    const opfContent = opfEntry.getData().toString("utf8");
    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    if (titleMatch) title = titleMatch[1].trim();
  }

  // Get content files (HTML/XHTML) in order from spine if possible
  let contentFiles: string[] = [];
  if (opfEntry) {
    const opfContent = opfEntry.getData().toString("utf8");
    // Parse spine order
    const spineMatches = opfContent.matchAll(/idref="([^"]+)"/g);
    const spineIds = [...spineMatches].map(m => m[1]);
    // Map ids to hrefs
    const manifestMatches = opfContent.matchAll(/<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"/g);
    const idToHref = new Map<string, string>();
    for (const m of manifestMatches) {
      idToHref.set(m[1], m[2]);
    }
    // Get OPF directory
    const opfDir = opfEntry.entryName.includes("/") ? opfEntry.entryName.split("/").slice(0, -1).join("/") + "/" : "";
    contentFiles = spineIds
      .map(id => idToHref.get(id))
      .filter((href): href is string => !!href)
      .map(href => opfDir + href);
  }

  // Fallback: all HTML/XHTML files sorted
  if (contentFiles.length === 0) {
    contentFiles = entries
      .filter(e => /\.(html|xhtml|htm)$/i.test(e.entryName) && !e.entryName.includes("toc"))
      .sort((a, b) => a.entryName.localeCompare(b.entryName))
      .map(e => e.entryName);
  }

  const textParts: string[] = [];
  for (const file of contentFiles) {
    const entry = entries.find(e => e.entryName === file || e.entryName.endsWith("/" + file));
    if (!entry) continue;
    const html = entry.getData().toString("utf8");
    const text = extractTextFromHtml(html);
    textParts.push(text);
  }

  return { title, content: textParts.join("\n\n") };
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter(p => p.length > 3);
}

// POST /books/upload - multipart file upload (TXT or EPUB)
router.post("/books/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { originalname, buffer, mimetype } = req.file;
  const customTitle = (req.body?.title as string | undefined)?.trim();
  const customAuthor = (req.body?.author as string | undefined)?.trim();

  try {
    let content = "";
    let detectedTitle = customTitle || originalname.replace(/\.(txt|epub)$/i, "").replace(/[-_]/g, " ");

    if (originalname.toLowerCase().endsWith(".epub") || mimetype === "application/epub+zip") {
      const parsed = parseEpub(buffer);
      content = parsed.content;
      if (!customTitle) detectedTitle = parsed.title;
    } else {
      // TXT file
      content = buffer.toString("utf8");
    }

    const paragraphs = splitIntoParagraphs(content);

    if (paragraphs.length === 0) {
      return res.status(400).json({ error: "Could not extract readable text from the file" });
    }

    const [book] = await db.insert(booksTable).values({
      title: customTitle || detectedTitle,
      author: customAuthor || null,
      language: "en",
      totalParagraphs: paragraphs.length,
      translatedParagraphs: 0,
      translationStatus: "pending",
    }).returning();

    // Insert paragraphs in batches of 200
    for (let i = 0; i < paragraphs.length; i += 200) {
      const batch = paragraphs.slice(i, i + 200).map((text, j) => ({
        bookId: book.id,
        position: i + j,
        originalText: text,
        translatedText: null,
        isTranslated: false,
      }));
      await db.insert(paragraphsTable).values(batch);
    }

    return res.status(201).json({
      id: book.id,
      title: book.title,
      author: book.author ?? undefined,
      language: book.language,
      totalParagraphs: book.totalParagraphs,
      translatedParagraphs: 0,
      translationStatus: book.translationStatus,
      createdAt: book.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "File upload failed");
    return res.status(500).json({ error: "Failed to process file" });
  }
});

export default router;
