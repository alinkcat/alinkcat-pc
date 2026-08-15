package com.ailinkcat.mobile.utils

import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipFile

/**
 * 文件操作工具类：大小/速度格式化、SHA-256 校验、.alc（zip）解压。
 */
object FileUtils {

    fun ensureDirs(vararg dirs: File) {
        dirs.forEach { if (!it.exists()) it.mkdirs() }
    }

    /**
     * 存储空间检查：目录可用空间需大于 requiredBytes × reserveMultiplier
     * （默认预留 1.5 倍，供解压使用）。
     */
    fun hasEnoughSpace(
        directory: File,
        requiredBytes: Long,
        reserveMultiplier: Double = 1.5
    ): Boolean {
        if (requiredBytes < 0) return false
        val needed = (requiredBytes * reserveMultiplier).toLong()
        return directory.usableSpace > needed
    }

    fun formatSize(bytes: Long): String {
        if (bytes < 0) return "0 B"
        if (bytes < 1024) return "$bytes B"
        val kb = bytes / 1024.0
        if (kb < 1024) return String.format("%.1f KB", kb)
        val mb = kb / 1024.0
        if (mb < 1024) return String.format("%.1f MB", mb)
        return String.format("%.2f GB", mb / 1024.0)
    }

    fun formatSpeed(kbPerSecond: Float): String {
        if (kbPerSecond < 0f) return "0 KB/s"
        if (kbPerSecond < 1024f) return String.format("%.1f KB/s", kbPerSecond)
        return String.format("%.2f MB/s", kbPerSecond / 1024f)
    }

    /**
     * 计算文件 SHA-256（小写十六进制）。
     */
    fun sha256(file: File): String? {
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            FileInputStream(file).use { input ->
                val buffer = ByteArray(8192)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    digest.update(buffer, 0, read)
                }
            }
            digest.digest().joinToString("") { "%02x".format(it) }
        } catch (_: Exception) {
            null
        }
    }

    /**
     * 解压 .alc（zip）文件到目标目录，带路径穿越防护。
     */
    fun unzipTo(zipFile: File, destDir: File): Boolean {
        return try {
            destDir.mkdirs()
            ZipFile(zipFile).use { zip ->
                val entries = zip.entries()
                while (entries.hasMoreElements()) {
                    val entry = entries.nextElement()
                    val target = resolveSafe(destDir, entry) ?: continue
                    if (entry.isDirectory) {
                        target.mkdirs()
                    } else {
                        target.parentFile?.mkdirs()
                        zip.getInputStream(entry).use { input ->
                            target.outputStream().use { output -> input.copyTo(output) }
                        }
                    }
                }
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun resolveSafe(destDir: File, entry: ZipEntry): File? {
        val name = entry.name
        if (name.startsWith("/") || name.contains("..")) return null
        val target = File(destDir, name)
        val canonical = target.canonicalPath
        if (!canonical.startsWith(destDir.canonicalPath + File.separator)) return null
        return target
    }
}
