package com.ailinkcat.mobile

import com.ailinkcat.mobile.i18n.LanguagePackParser
import com.ailinkcat.mobile.i18n.PackValidation
import com.ailinkcat.mobile.i18n.RejectReason
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** pack parser/validation unit tests, covering the rules in docs/多语言与语言包协议.md §1.3 */
class LanguagePackParserTest {

    private val baseline = mapOf(
        "app_name" to "Ailinkcat",
        "hello" to "Hello",
        "greeting_name" to "Hello, %1\$s",
        "count_items" to "%1\$d items",
        "size_format" to "%d MB",
        "settings_title" to "Settings"
    )

    private fun validJson(extra: String = ""): String = """
        {
            "code": "ja-JP",
            "label": "日本語",
            "platform": "android",
            "version": 1,
            "keyCount": 2,
            "rtl": false,
            "resources": {
                "app_name": "エイリンキャット",
                "hello": "こんにちは"
                $extra
            }
        }
    """.trimIndent()

    // happy path

    @Test
    fun `valid pack parses`() {
        val result = LanguagePackParser.parse(validJson(), baseline)
        assertTrue(result is PackValidation.Valid)
        result as PackValidation.Valid
        assertEquals("ja-JP", result.pack.code)
        assertEquals(2, result.translatedKeys)
        assertEquals(6, result.totalKeys)
        assertTrue(result.unknownKeys.isEmpty())
        assertTrue(result.placeholderMismatches.isEmpty())
    }

    @Test
    fun `placeholder match accepted`() {
        val json = """
            {
                "code": "ja-JP", "label": "日本語", "platform": "android", "version": 1,
                "resources": { "greeting_name": "こんにちは、%1${'$'}s" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Valid)
        result as PackValidation.Valid
        assertEquals(1, result.translatedKeys)
    }

    @Test
    fun `placeholder mismatch falls back not rejected`() {
        val json = """
            {
                "code": "ja-JP", "label": "日本語", "platform": "android", "version": 1,
                "resources": { "greeting_name": "こんにちは、%2${'$'}s" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Valid)
        result as PackValidation.Valid
        assertEquals(0, result.translatedKeys)
        assertEquals(listOf("greeting_name"), result.placeholderMismatches)
    }

    @Test
    fun `bare positional equivalence accepted`() {
        // baseline "%d MB" translated as positional "%1$d MB" — same type, accepted
        val json = """
            {
                "code": "ja-JP", "label": "日本語", "platform": "android", "version": 1,
                "resources": { "size_format": "%1${'$'}d MB" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Valid)
        result as PackValidation.Valid
        assertTrue(result.placeholderMismatches.isEmpty())
    }

    @Test
    fun `wrong type for bare baseline key falls back`() {
        // "%d" baseline translated with %s would crash String.format at runtime —
        // the pack value must fall back to english, not get installed
        val json = """
            {
                "code": "ja-JP", "label": "日本語", "platform": "android", "version": 1,
                "resources": { "size_format": "%s MB" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Valid)
        result as PackValidation.Valid
        assertEquals(listOf("size_format"), result.placeholderMismatches)
    }

    @Test
    fun `unknown key is dropped and reported`() {
        val json = """
            {
                "code": "ja-JP", "label": "日本語", "platform": "android", "version": 1,
                "resources": { "not_a_real_key": "なにか" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Valid)
        result as PackValidation.Valid
        assertEquals(0, result.translatedKeys)
        assertEquals(listOf("not_a_real_key"), result.unknownKeys)
    }

    @Test
    fun `missing keys allowed for partial coverage`() {
        val result = LanguagePackParser.parse(validJson(), baseline)
        assertTrue(result is PackValidation.Valid)
        result as PackValidation.Valid
        assertEquals(2, result.translatedKeys)
        assertEquals(6, result.totalKeys)
    }

    // rejection paths

    @Test
    fun `malformed json rejected`() {
        val result = LanguagePackParser.parse("{not json", baseline)
        assertTrue(result is PackValidation.Invalid)
        assertEquals(RejectReason.MALFORMED_JSON, (result as PackValidation.Invalid).reason)
    }

    @Test
    fun `missing field rejected`() {
        val json = """{ "code": "ja-JP", "label": "日本語" }"""
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Invalid)
        assertEquals(RejectReason.MISSING_FIELD, (result as PackValidation.Invalid).reason)
    }

    @Test
    fun `wrong platform rejected`() {
        val json = """
            {
                "code": "ja-JP", "label": "日本語", "platform": "pc", "version": 1,
                "resources": { "app_name": "x" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Invalid)
        assertEquals(RejectReason.WRONG_PLATFORM, (result as PackValidation.Invalid).reason)
    }

    @Test
    fun `unsupported version rejected`() {
        val json = """
            {
                "code": "ja-JP", "label": "日本語", "platform": "android", "version": 2,
                "resources": { "app_name": "x" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Invalid)
        assertEquals(RejectReason.UNSUPPORTED_VERSION, (result as PackValidation.Invalid).reason)
    }

    @Test
    fun `non positive version rejected`() {
        val json = """
            {
                "code": "ja-JP", "label": "日本語", "platform": "android", "version": 0,
                "resources": { "app_name": "x" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Invalid)
        assertEquals(RejectReason.UNSUPPORTED_VERSION, (result as PackValidation.Invalid).reason)
    }

    @Test
    fun `invalid code rejected`() {
        val json = """
            {
                "code": "ja@@", "label": "日本語", "platform": "android", "version": 1,
                "resources": { "app_name": "x" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Invalid)
        assertEquals(RejectReason.INVALID_CODE, (result as PackValidation.Invalid).reason)
    }

    @Test
    fun `too many keys rejected`() {
        val resources = (1..501).joinToString(",") { "\"k$it\": \"v\"" }
        val json = """
            {
                "code": "ja-JP", "label": "日本語", "platform": "android", "version": 1,
                "resources": { $resources }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Invalid)
        assertEquals(RejectReason.TOO_MANY_KEYS, (result as PackValidation.Invalid).reason)
    }

    @Test
    fun `overlong value rejected`() {
        val longValue = "a".repeat(501)
        val json = """
            {
                "code": "ja-JP", "label": "日本語", "platform": "android", "version": 1,
                "resources": { "app_name": "$longValue" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Invalid)
        assertEquals(RejectReason.VALUE_TOO_LONG, (result as PackValidation.Invalid).reason)
    }

    // envelope fields

    @Test
    fun `rtl flag propagated`() {
        val json = """
            {
                "code": "ar", "label": "العربية", "platform": "android", "version": 1,
                "rtl": true,
                "resources": { "app_name": "أيلينك" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Valid)
        result as PackValidation.Valid
        assertTrue(result.pack.rtl)
    }

    @Test
    fun `two letter code accepted`() {
        val json = """
            {
                "code": "ja", "label": "日本語", "platform": "android", "version": 1,
                "resources": { "app_name": "エイリン" }
            }
        """.trimIndent()
        val result = LanguagePackParser.parse(json, baseline)
        assertTrue(result is PackValidation.Valid)
    }

    // loadInstalled (trusted, no baseline check)

    @Test
    fun `loadInstalled parses envelope without baseline`() {
        val pack = LanguagePackParser.loadInstalled(validJson())
        assertNotNull(pack)
        assertEquals("ja-JP", pack!!.code)
        assertEquals("日本語", pack.label)
        assertEquals(2, pack.resources.size)
    }

    @Test
    fun `loadInstalled returns null on malformed`() {
        val pack = LanguagePackParser.loadInstalled("not json")
        assertEquals(null, pack)
    }
}
