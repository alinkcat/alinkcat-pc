package com.ailinkcat.mobile.util

import org.json.JSONArray
import org.json.JSONObject

/**
 * 极简的 JSONPath 实现，仅支持点号 (.) 与数组下标 [] 表达式。
 * 例如："weather[0].icon"、"main.temp"。
 */
object JsonPath {
    fun get(json: JSONObject, path: String): Any? {
        var current: Any = json
        val parts = path.split('.')
        for (part in parts) {
            if (current is JSONObject) {
                val (key, idx) = parseArrayIndex(part)
                current = current.opt(key) ?: return null
                if (idx != null) {
                    if (current is JSONArray) {
                        current = current.opt(idx) ?: return null
                    } else return null
                }
            } else if (current is JSONArray) {
                val idx = part.toIntOrNull() ?: return null
                current = current.opt(idx) ?: return null
            } else return null
        }
        return current
    }

    private fun parseArrayIndex(part: String): Pair<String, Int?> {
        val start = part.indexOf('[')
        return if (start >= 0 && part.endsWith(']')) {
            val key = part.substring(0, start)
            val idx = part.substring(start + 1, part.length - 1).toIntOrNull()
            Pair(key, idx)
        } else {
            Pair(part, null)
        }
    }
}
