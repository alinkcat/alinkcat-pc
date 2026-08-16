package com.ailinkcat.mobile.domain.models

import org.json.JSONArray
import org.json.JSONObject

/**
 * 主题包数据模型（对应 files/themes/{themeId}/theme.json）。
 */
data class Theme(
    val id: String,
    val name: String,
    val version: String,
    val author: String,
    val description: String,
    val pages: List<Page>
) {
    companion object {
        fun fromJson(json: JSONObject): Theme {
            val pagesArray = json.optJSONArray("pages") ?: JSONArray()
            val pages = buildList {
                for (i in 0 until pagesArray.length()) {
                    Page.fromJson(pagesArray.optJSONObject(i))?.let(::add)
                }
            }
            return Theme(
                id = json.optString("id", ""),
                name = json.optString("name", "Unnamed Theme"),
                version = json.optString("version", "1.0.0"),
                author = json.optString("author", ""),
                description = json.optString("description", ""),
                pages = pages
            )
        }
    }
}

enum class LayoutMode { GRID, FREE }

data class Page(
    val id: String,
    val label: String,
    val layoutMode: LayoutMode,
    val columns: Int?,
    val rows: Int?,
    val backgroundColor: String?,
    val backgroundImage: String?,
    val backgroundMode: String?, // cover / contain / stretch / tile
    val backgroundOpacity: Int?, // 0-100
    val widgets: List<Widget>
) {
    companion object {
        fun fromJson(json: JSONObject?): Page? {
            if (json == null) return null

            // PC 端结构：page.layout = { type, columns, rows, backgroundColor, backgroundImage, backgroundMode, backgroundOpacity }
            val layout = json.optJSONObject("layout")

            // 兼容旧扁平结构：page.layoutMode / page.columns 等
            val layoutType = layout?.optString("type")
                ?: json.optString("layoutMode", "grid")

            val widgetsArray = json.optJSONArray("widgets") ?: JSONArray()
            val widgets = buildList {
                for (i in 0 until widgetsArray.length()) {
                    Widget.fromJson(widgetsArray.optJSONObject(i))?.let(::add)
                }
            }
            return Page(
                id = json.optString("id", ""),
                label = json.optString("label", "Page"),
                layoutMode = if (layoutType.equals("FREE", ignoreCase = true) ||
                    layoutType.equals("free", ignoreCase = true)
                ) LayoutMode.FREE else LayoutMode.GRID,
                columns = layout?.optInt("columns", -1)?.takeIf { it > 0 }
                    ?: json.optInt("columns", -1).takeIf { it > 0 },
                rows = layout?.optInt("rows", -1)?.takeIf { it > 0 }
                    ?: json.optInt("rows", -1).takeIf { it > 0 },
                backgroundColor = layout?.optString("backgroundColor")?.ifBlank { null }
                    ?: json.optString("backgroundColor").ifBlank { null },
                backgroundImage = layout?.optString("backgroundImage")?.ifBlank { null }
                    ?: json.optString("backgroundImage").ifBlank { null },
                backgroundMode = layout?.optString("backgroundMode")?.ifBlank { null }
                    ?: json.optString("backgroundMode").ifBlank { null },
                backgroundOpacity = layout?.optInt("backgroundOpacity", -1)?.takeIf { it in 0..100 }
                    ?: json.optInt("backgroundOpacity", -1).takeIf { it in 0..100 },
                widgets = widgets
            )
        }
    }
}
