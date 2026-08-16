package com.ailinkcat.mobile.domain.repository

import android.content.Context
import com.ailinkcat.mobile.domain.models.Theme
import com.ailinkcat.mobile.websocket.models.ThemeMeta
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

/**
 * 主题包存储操作：内部存储，无需额外权限。
 * - 最终存储：files/themes/{themeId}/
 * - 临时文件：cache/push_temp/{themeId}.alc.part
 */
class ThemeRepository(private val context: Context) {

    private val themesDir = File(context.filesDir, "themes")
    private val tempDir = File(context.cacheDir, "push_temp")

    init {
        if (!themesDir.exists()) themesDir.mkdirs()
        if (!tempDir.exists()) tempDir.mkdirs()
    }

    fun getThemesDir(): File = themesDir

    fun getTempDir(): File = tempDir

    fun themeDir(themeId: String): File = File(themesDir, themeId)

    fun tempFile(themeId: String): File = File(tempDir, "$themeId.alc.part")

    fun themeFile(themeId: String): File = File(themeDir(themeId), "theme.json")

    fun themeExists(themeId: String): Boolean = themeDir(themeId).exists() && themeFile(themeId).exists()

    /** 封面图路径：files/themes/{themeId}/cover.png */
    fun getCoverFile(themeId: String): File = File(themeDir(themeId), "cover.png")

    /**
     * 加载主题包定义（files/themes/{themeId}/theme.json）。
     */
    suspend fun loadTheme(themeId: String): Result<Theme> = withContext(Dispatchers.IO) {
        runCatching {
            val file = themeFile(themeId)
            if (!file.exists()) error("Theme file does not exist")
            Theme.fromJson(JSONObject(file.readText()))
        }
    }

    fun saveMeta(meta: ThemeMeta) {
        val dir = themeDir(meta.themeId)
        if (!dir.exists()) dir.mkdirs()
        val json = JSONObject()
            .put("themeId", meta.themeId)
            .put("name", meta.name)
            .put("version", meta.version)
            .put("hash", meta.hash)
            .put("receivedAt", meta.receivedAt)
        File(dir, "meta.json").writeText(json.toString())
    }

    fun loadThemes(): List<ThemeMeta> {
        if (!themesDir.exists()) return emptyList()
        return themesDir.listFiles()
            ?.filter { it.isDirectory }
            ?.mapNotNull { dir ->
                val metaFile = File(dir, "meta.json")
                if (!metaFile.exists()) return@mapNotNull null
                try {
                    val json = JSONObject(metaFile.readText())
                    ThemeMeta(
                        themeId = json.optString("themeId", dir.name),
                        name = json.optString("name", dir.name),
                        version = json.optString("version", "1.0.0"),
                        hash = json.optString("hash", ""),
                        receivedAt = json.optLong("receivedAt", 0L)
                    )
                } catch (_: Exception) {
                    null
                }
            }
            ?: emptyList()
    }

    fun deleteTheme(themeId: String) {
        runCatching { themeDir(themeId).deleteRecursively() }
    }

    fun deleteTempFile(themeId: String) {
        runCatching { tempFile(themeId).delete() }
    }

    /**
     * 清理超过 [maxAgeMs] 的临时文件（应用启动时调用）。
     */
    fun cleanupStaleTempFiles(maxAgeMs: Long = 24L * 3600L * 1000L) {
        val now = System.currentTimeMillis()
        tempDir.listFiles()?.forEach { file ->
            if (now - file.lastModified() > maxAgeMs) {
                runCatching { file.delete() }
            }
        }
    }
}
