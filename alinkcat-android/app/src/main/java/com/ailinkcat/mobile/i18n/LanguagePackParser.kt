package com.ailinkcat.mobile.i18n

import org.json.JSONException
import org.json.JSONObject
import java.util.regex.Pattern

/** dynamic language pack data (envelope fields + flat resource map) */
data class LanguagePack(
    val code: String,
    val label: String,
    val version: Int,
    val keyCount: Int,
    val rtl: Boolean,
    val resources: Map<String, String>
)

/** valid (with coverage info) or rejected (with reason) */
sealed class PackValidation {
    /** [translatedKeys] valid keys (not in the english baseline are dropped),
     *  [unknownKeys] exist only in the pack (inert after install),
     *  [placeholderMismatches] fall back to english */
    data class Valid(
        val pack: LanguagePack,
        val translatedKeys: Int,
        val totalKeys: Int,
        val unknownKeys: List<String>,
        val placeholderMismatches: List<String>
    ) : PackValidation()

    data class Invalid(val reason: RejectReason) : PackValidation()
}

enum class RejectReason {
    MALFORMED_JSON,
    MISSING_FIELD,
    /** e.g. a PC-side language pack */
    WRONG_PLATFORM,
    UNSUPPORTED_VERSION,
    TOO_MANY_KEYS,
    VALUE_TOO_LONG,
    INVALID_CODE
}

/** pure kotlin pack parser/validation, no android deps so it's unit-testable.
 *  rules per docs/多语言与语言包协议.md §1.3: platform "android", version <= 1,
 *  <= 500 keys, values <= 500 chars, per-key placeholder check against the english
 *  baseline (mismatches fall back per key, missing keys are allowed) */
object LanguagePackParser {

    const val SUPPORTED_VERSION = 1
    const val MAX_KEYS = 500
    const val MAX_VALUE_LENGTH = 500

    // positional (%1$s) and bare (%s) forms both count; %% escapes are ignored
    private val PLACEHOLDER = Pattern.compile("%(\\d+\\$)?[sd]")
    private val CODE_PATTERN = Pattern.compile("[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*")

    fun parse(jsonText: String, baseline: Map<String, String>): PackValidation {
        val root = try {
            JSONObject(jsonText)
        } catch (e: JSONException) {
            return PackValidation.Invalid(RejectReason.MALFORMED_JSON)
        }

        // required fields
        val code = root.optString("code").trim()
        val label = root.optString("label").trim()
        val platform = root.optString("platform").trim()
        if (code.isEmpty() || label.isEmpty() || platform.isEmpty()) {
            return PackValidation.Invalid(RejectReason.MISSING_FIELD)
        }
        if (!root.has("version")) return PackValidation.Invalid(RejectReason.MISSING_FIELD)
        val version = root.optInt("version", -1)
        val resourcesObj = root.optJSONObject("resources") ?: return PackValidation.Invalid(RejectReason.MISSING_FIELD)

        // rule checks
        if (!platform.equals("android", ignoreCase = true)) return PackValidation.Invalid(RejectReason.WRONG_PLATFORM)
        if (version > SUPPORTED_VERSION) return PackValidation.Invalid(RejectReason.UNSUPPORTED_VERSION)
        if (version <= 0) return PackValidation.Invalid(RejectReason.UNSUPPORTED_VERSION)
        if (!CODE_PATTERN.matcher(code).matches()) return PackValidation.Invalid(RejectReason.INVALID_CODE)
        if (resourcesObj.length() > MAX_KEYS) return PackValidation.Invalid(RejectReason.TOO_MANY_KEYS)

        val unknown = mutableListOf<String>()
        val mismatches = mutableListOf<String>()
        val resources = mutableMapOf<String, String>()
        val keys = resourcesObj.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = resourcesObj.optString(key)
            if (value.length > MAX_VALUE_LENGTH) return PackValidation.Invalid(RejectReason.VALUE_TOO_LONG)
            val enBaseline = baseline[key]
            if (enBaseline == null) {
                // not in the baseline: dead key, drop it
                unknown.add(key)
                continue
            }
            if (placeholderTypes(enBaseline) != placeholderTypes(value)) {
                // placeholder mismatch: this key falls back to english, doesn't block the pack
                mismatches.add(key)
                continue
            }
            resources[key] = value
        }

        val pack = LanguagePack(
            code = code,
            label = label,
            version = version,
            keyCount = root.optInt("keyCount", resources.size),
            rtl = root.optBoolean("rtl", false),
            resources = resources
        )
        return PackValidation.Valid(
            pack = pack,
            translatedKeys = resources.size,
            totalKeys = baseline.size,
            unknownKeys = unknown,
            placeholderMismatches = mismatches
        )
    }

    /** sorted placeholder types; positional and bare forms are equal */
    internal fun placeholderTypes(format: String): List<String> {
        val m = PLACEHOLDER.matcher(format)
        val pairs = mutableListOf<String>()
        var next = 1
        while (m.find()) {
            // "%2$s" pins arg 2; a bare "%s" consumes args sequentially. a lone
            // "%2$s" for a single-arg baseline crashes String.format, so the
            // argument index is part of the comparison, not just the type
            val idx = m.group(1)?.dropLast(1)?.toIntOrNull() ?: next
            pairs.add(idx.toString() + ":" + m.group().takeLast(1))
            next = idx + 1
        }
        return pairs.sorted()
    }

    /** installed packs already passed full validation at install time; structure parse
     *  only, null on failure (treated as a missing pack) */
    fun loadInstalled(jsonText: String): LanguagePack? {
        return try {
            val root = JSONObject(jsonText)
            val resourcesObj = root.optJSONObject("resources") ?: return null
            val resources = mutableMapOf<String, String>()
            val keys = resourcesObj.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                resources[key] = resourcesObj.optString(key)
            }
            LanguagePack(
                code = root.optString("code"),
                label = root.optString("label"),
                version = root.optInt("version", 1),
                keyCount = root.optInt("keyCount", resources.size),
                rtl = root.optBoolean("rtl", false),
                resources = resources
            )
        } catch (e: Exception) {
            null
        }
    }
}
