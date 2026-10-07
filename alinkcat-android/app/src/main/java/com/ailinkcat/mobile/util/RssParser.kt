package com.ailinkcat.mobile.util

import org.json.JSONArray
import org.json.JSONObject

/** extracts <item>/<entry> into [{title, description, pubDate, link}] for the WebView rss mode.
 *  regex based, handles CDATA and Atom */
object RssParser {

    private val ITEM_REGEX = Regex("<(item|entry)[\\s\\S]*?</\\1>", RegexOption.IGNORE_CASE)
    private val CDATA_REGEX = Regex("^\\s*<!\\[CDATA\\[([\\s\\S]*?)]]>\\s*$")

    /** empty array for non-RSS or blank input */
    fun parse(xml: String, limit: Int = 20): JSONArray {
        val items = JSONArray()
        if (xml.isBlank()) return items
        for (match in ITEM_REGEX.findAll(xml).take(limit)) {
            val block = match.value
            val obj = JSONObject()
            obj.put("title", extract(block, "title")?.ifBlank { null } ?: "Untitled")
            obj.put("description", extract(block, "description") ?: extract(block, "summary"))
            obj.put("pubDate", extract(block, "pubDate") ?: extract(block, "updated")
                ?: extract(block, "published"))
            obj.put("link", extractLink(block))
            items.put(obj)
        }
        return items
    }

    /** null when the tag is missing, same as a missing field */
    private fun extract(block: String, tag: String): String? {
        val regex = Regex("<$tag(?:\\s[^>]*)?>([\\s\\S]*?)</$tag>", RegexOption.IGNORE_CASE)
        val raw = regex.find(block)?.groupValues?.get(1) ?: return null
        val text = (CDATA_REGEX.find(raw)?.groupValues?.get(1) ?: raw)
            .replace(Regex("<[\\s\\S]*?>"), " ")
            .let(::decodeEntities)
            .replace(Regex("\\s+"), " ")
            .trim()
        return text
    }

    // &amp; last so it doesn't get double-decoded
    private fun decodeEntities(s: String): String = s
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace(Regex("&#x([0-9A-Fa-f]+);")) { it.groupValues[1].toInt(16).toChar().toString() }
        .replace(Regex("&#(\\d+);")) { it.groupValues[1].toInt().toChar().toString() }
        .replace("&amp;", "&")

    private fun extractLink(block: String): String {
        // RSS: <link>text</link>; Atom: <link href="..." .../>
        val tag = extract(block, "link")
        if (!tag.isNullOrBlank()) return tag
        val href = Regex("<link[^>]*href=\"([^\"]+)\"", RegexOption.IGNORE_CASE)
            .find(block)?.groupValues?.get(1) ?: ""
        return href
    }
}
