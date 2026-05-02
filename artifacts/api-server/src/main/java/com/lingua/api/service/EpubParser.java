package com.lingua.api.service;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.io.ByteArrayInputStream;
import java.util.HashMap;

@Component
public class EpubParser {

    public record EpubResult(String title, String content) {}

    public EpubResult parse(byte[] data) throws IOException {
        Map<String, byte[]> entries = new HashMap<>();

        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(data))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (!entry.isDirectory()) {
                    entries.put(entry.getName(), zip.readAllBytes());
                }
                zip.closeEntry();
            }
        }

        // Find OPF file
        String opfName = entries.keySet().stream()
                .filter(n -> n.endsWith(".opf"))
                .findFirst()
                .orElse(null);

        String title = "Untitled";
        List<String> contentFiles = new ArrayList<>();

        if (opfName != null) {
            String opfContent = new String(entries.get(opfName));

            // Extract title
            Matcher titleM = Pattern.compile("<dc:title[^>]*>([^<]+)</dc:title>", Pattern.CASE_INSENSITIVE)
                    .matcher(opfContent);
            if (titleM.find()) {
                title = titleM.group(1).trim();
            }

            // Parse spine order
            String opfDir = opfName.contains("/") ? opfName.substring(0, opfName.lastIndexOf('/') + 1) : "";
            Map<String, String> idToHref = new HashMap<>();
            Matcher manifestM = Pattern.compile("<item[^>]+id=\"([^\"]+)\"[^>]+href=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE)
                    .matcher(opfContent);
            while (manifestM.find()) {
                idToHref.put(manifestM.group(1), manifestM.group(2));
            }

            Matcher spineM = Pattern.compile("idref=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE).matcher(opfContent);
            while (spineM.find()) {
                String href = idToHref.get(spineM.group(1));
                if (href != null) {
                    contentFiles.add(opfDir + href);
                }
            }
        }

        // Fallback: sorted HTML files
        if (contentFiles.isEmpty()) {
            entries.keySet().stream()
                    .filter(n -> n.matches("(?i).*\\.(html|xhtml|htm)") && !n.contains("toc"))
                    .sorted()
                    .forEach(contentFiles::add);
        }

        StringBuilder sb = new StringBuilder();
        for (String file : contentFiles) {
            byte[] fileData = entries.get(file);
            if (fileData == null) {
                // Try without prefix
                String stripped = file.contains("/") ? file.substring(file.lastIndexOf('/') + 1) : file;
                fileData = entries.entrySet().stream()
                        .filter(e -> e.getKey().endsWith("/" + stripped) || e.getKey().equals(stripped))
                        .map(Map.Entry::getValue)
                        .findFirst()
                        .orElse(null);
            }
            if (fileData != null) {
                sb.append(extractTextFromHtml(new String(fileData))).append("\n\n");
            }
        }

        return new EpubResult(title, sb.toString());
    }

    private String extractTextFromHtml(String html) {
        String text = html.replaceAll("(?is)<script[\\s\\S]*?</script>", "");
        text = text.replaceAll("(?is)<style[\\s\\S]*?</style>", "");
        text = text.replaceAll("(?i)</(p|div|h[1-6]|li|br|tr|blockquote)>", "\n");
        text = text.replaceAll("(?i)<br\\s*/?>", "\n");
        text = text.replaceAll("<[^>]+>", "");
        text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                .replace("&quot;", "\"").replace("&#39;", "'").replace("&nbsp;", " ");
        return text;
    }

    public List<String> splitIntoParagraphs(String text) {
        List<String> result = new ArrayList<>();
        for (String p : text.split("\n{2,}")) {
            String trimmed = p.replace("\n", " ").replaceAll("\\s+", " ").trim();
            if (trimmed.length() > 3) {
                result.add(trimmed);
            }
        }
        return result;
    }
}
