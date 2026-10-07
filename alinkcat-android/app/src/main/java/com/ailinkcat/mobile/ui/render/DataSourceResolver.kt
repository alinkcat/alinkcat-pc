package com.ailinkcat.mobile.ui.render

/**
 * Maps a theme pack's dataSource name to a live data key, matching the fields
 * the PC pushes via monitor.data
 * (cpu / memory / disk / uptime / network.upload / network.download).
 */
object DataSourceResolver {

    val MAP: Map<String, String> = mapOf(
        "system.cpu.usage" to "cpu",
        "system.memory.usage" to "memory",
        "system.disk.usage" to "disk",
        "system.network.upload" to "network.upload",
        "system.network.download" to "network.download",
        "system.uptime" to "uptime",
        "system.battery.level" to "battery",
        "system.battery.temperature" to "battery.temperature"
    )

    val SUBSCRIBE_SOURCES: List<String> =
        listOf("cpu", "memory", "network", "disk", "uptime", "battery", "battery.temperature")

    val INTERNAL_KEYS: Set<String> = MAP.values.toSet()

    fun resolve(dataSource: String): String = MAP[dataSource] ?: dataSource
}
