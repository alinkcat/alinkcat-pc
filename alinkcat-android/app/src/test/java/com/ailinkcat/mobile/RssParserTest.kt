package com.ailinkcat.mobile

import com.ailinkcat.mobile.util.RssParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** rss parser tests: CDATA, embedded html, atom links, empty/bad input */
class RssParserTest {

    private val sampleRss = """
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel>
            <title>Channel</title>
            <item>
                <title>第一篇 &amp; 更多</title>
                <link>https://example.com/a</link>
                <pubDate>Mon, 01 Sep 2026 08:00:00 GMT</pubDate>
                <description><![CDATA[<p>内容 <b>加粗</b></p>]]></description>
            </item>
            <item>
                <title type="html">第二篇</title>
                <link href="https://example.com/b"/>
                <description>纯文本摘要</description>
            </item>
        </channel></rss>
    """.trimIndent()

    @Test
    fun parseExtractsItems() {
        val items = RssParser.parse(sampleRss)
        assertEquals(2, items.length())
        assertEquals("第一篇 & 更多", items.getJSONObject(0).optString("title"))
        assertEquals("https://example.com/a", items.getJSONObject(0).optString("link"))
        assertEquals("内容 加粗", items.getJSONObject(0).optString("description"))
        assertEquals("Mon, 01 Sep 2026 08:00:00 GMT", items.getJSONObject(0).optString("pubDate"))
    }

    @Test
    fun parseAtomStyleLink() {
        val items = RssParser.parse(sampleRss)
        assertEquals("https://example.com/b", items.getJSONObject(1).optString("link"))
        assertEquals("纯文本摘要", items.getJSONObject(1).optString("description"))
    }

    @Test
    fun parseEmptyAndGarbageReturnEmptyArray() {
        assertEquals(0, RssParser.parse("").length())
        assertEquals(0, RssParser.parse("<html><body>not rss</body></html>").length())
    }

    @Test
    fun parseRespectsLimit() {
        val many = buildString {
            append("<rss><channel>")
            repeat(30) { i ->
                append("<item><title>t$i</title></item>")
            }
            append("</channel></rss>")
        }
        assertEquals(20, RssParser.parse(many).length())
        assertTrue(RssParser.parse(many, 5).length() <= 5)
    }

    @Test
    fun missingFieldsAreNullNotCrash() {
        val items = RssParser.parse("<rss><channel><item><title>only title</title></item></channel></rss>")
        val obj = items.getJSONObject(0)
        assertNull(obj.optJSONObject("description"))
        assertEquals("", obj.optString("link"))
    }
}
