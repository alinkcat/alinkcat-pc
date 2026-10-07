package com.ailinkcat.mobile.utils

import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipFile

/** file helpers: size/speed formatting, sha-256, .alc (zip) extraction */
object FileUtils {

    // zip bomb guard: 500MB total uncompressed
    private const val MAX_UNZIP_BYTES = 500L * 1024 * 1024

    // zip bomb guard: 5000 entries
    private const val MAX_UNZIP_ENTRIES = 5000

    fun ensureDirs(vararg dirs: File) {
        dirs.forEach { if (!it.exists()) it.mkdirs() }
    }

    /** usable space must exceed requiredBytes x reserveMultiplier (default 1.5) */
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

    /** file sha-256 as lowercase hex */
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

    /** unzip a .alc to destDir with path traversal and zip bomb protection;
     *  bails out and cleans up when a limit is hit */
    fun unzipTo(zipFile: File, destDir: File): Boolean {
        return try {
            destDir.mkdirs()
            ZipFile(zipFile).use { zip ->
                val entries = zip.entries()
                var entryCount = 0
                var totalBytes = 0L
                while (entries.hasMoreElements()) {
                    val entry = entries.nextElement()
                    entryCount++
                    if (entryCount > MAX_UNZIP_ENTRIES) {
                        // too many entries, treat as a zip bomb
                        destDir.deleteRecursively()
                        return false
                    }
                    val target = resolveSafe(destDir, entry) ?: continue
                    if (entry.isDirectory) {
                        target.mkdirs()
                    } else {
                        target.parentFile?.mkdirs()
                        zip.getInputStream(entry).use { input ->
                            target.outputStream().use { output ->
                                val buffer = ByteArray(8192)
                                while (true) {
                                    val read = input.read(buffer)
                                    if (read < 0) break
                                    output.write(buffer, 0, read)
                                    totalBytes += read
                                    if (totalBytes > MAX_UNZIP_BYTES) {
                                        // too many bytes, treat as a zip bomb
                                        destDir.deleteRecursively()
                                        return false
                                    }
                                }
                            }
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
